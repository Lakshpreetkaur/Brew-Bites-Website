-- ==============================================================================
-- PHASE 13: SERVER-SIDE ORDER VERIFICATION & ATOMIC CREATION RPC
-- ==============================================================================

-- 1. Create SECURITY DEFINER RPC Function for Server-Side Order Verification
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_cart_items JSONB,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_order_type TEXT,
  p_delivery_address TEXT,
  p_payment_method TEXT,
  p_currency TEXT DEFAULT 'USD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_currency TEXT;
  v_rate NUMERIC;
  v_pay_method TEXT;
  v_order_type TEXT;
  v_order_ref TEXT;
  v_order_id UUID;
  v_created_at TIMESTAMPTZ;
  v_payment_id UUID;
  v_payment_status TEXT;
  v_txn_ref TEXT;
  v_subtotal NUMERIC(10, 2) := 0.00;
  v_item JSONB;
  v_product_id TEXT;
  v_qty INTEGER;
  v_prod_name TEXT;
  v_prod_price NUMERIC;
  v_prod_avail BOOLEAN;
  v_unit_price NUMERIC(10, 2);
  v_line_total NUMERIC(10, 2);
  v_verified_items JSONB := '[]'::JSONB;
BEGIN
  -- 1. Verify Caller Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to place an order.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validate Currency & Exchange Rate (Strict Whitelist)
  v_currency := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  IF v_currency = 'USD' THEN
    v_rate := 1.0;
  ELSIF v_currency = 'INR' THEN
    v_rate := 83.0;
  ELSIF v_currency = 'CAD' THEN
    v_rate := 1.35;
  ELSIF v_currency = 'GBP' THEN
    v_rate := 0.78;
  ELSE
    RAISE EXCEPTION 'Unsupported currency "%". Supported currencies are USD, INR, CAD, GBP.', p_currency
      USING ERRCODE = '22023';
  END IF;

  -- 3. Validate Payment Method & Order Type
  v_pay_method := LOWER(TRIM(COALESCE(p_payment_method, '')));
  IF v_pay_method NOT IN ('cash_on_delivery', 'online') THEN
    RAISE EXCEPTION 'Invalid payment method "%". Must be cash_on_delivery or online.', p_payment_method
      USING ERRCODE = '22023';
  END IF;

  v_order_type := LOWER(TRIM(COALESCE(p_order_type, 'pickup')));
  IF v_order_type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid order type "%". Must be pickup or delivery.', p_order_type
      USING ERRCODE = '22023';
  END IF;

  -- 4. Validate Cart Payload
  IF p_cart_items IS NULL OR jsonb_typeof(p_cart_items) <> 'array' OR jsonb_array_length(p_cart_items) = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty.'
      USING ERRCODE = '22023';
  END IF;

  -- 5. Verify Products, Availability, and Calculate Server-Side Prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_product_id := TRIM(COALESCE(v_item->>'productId', v_item->>'product_id', ''));
    v_qty := (v_item->>'quantity')::INTEGER;

    IF v_product_id = '' THEN
      RAISE EXCEPTION 'Invalid cart item: missing product identifier.'
        USING ERRCODE = '22023';
    END IF;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity (%) for product ID "%". Quantity must be a positive integer.', v_qty, v_product_id
        USING ERRCODE = '22023';
    END IF;

    SELECT name, price, available
    INTO v_prod_name, v_prod_price, v_prod_avail
    FROM public.products
    WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID "%" does not exist in the catalog.', v_product_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_prod_avail IS FALSE THEN
      RAISE EXCEPTION 'Product "%" is currently sold out and unavailable.', v_prod_name
        USING ERRCODE = '22000';
    END IF;

    -- Calculate verified unit price and line total in transaction currency
    v_unit_price := ROUND((v_prod_price * v_rate)::NUMERIC, 2);
    v_line_total := ROUND((v_unit_price * v_qty)::NUMERIC, 2);
    v_subtotal := v_subtotal + v_line_total;

    -- Collect verified item metadata
    v_verified_items := v_verified_items || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_prod_name,
      'quantity', v_qty,
      'unit_price', v_unit_price,
      'line_total', v_line_total
    );
  END LOOP;

  -- 6. Concurrency-Safe Order Reference Generation & Order Insert
  FOR i IN 1..10 LOOP
    BEGIN
      v_order_ref := 'BB-DEMO-' || LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0');
      
      INSERT INTO public.orders (
        order_reference,
        user_id,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        delivery_address,
        subtotal,
        status
      ) VALUES (
        v_order_ref,
        v_user_id,
        COALESCE(p_customer_name, ''),
        COALESCE(p_customer_phone, ''),
        COALESCE(p_customer_email, ''),
        v_order_type,
        COALESCE(p_delivery_address, ''),
        v_subtotal,
        'placed'
      ) RETURNING id, created_at INTO v_order_id, v_created_at;

      EXIT; -- Success, break retry loop
    EXCEPTION
      WHEN unique_violation THEN
        IF i = 10 THEN
          -- Fallback high-entropy reference to guarantee uniqueness
          v_order_ref := 'BB-DEMO-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
          INSERT INTO public.orders (
            order_reference,
            user_id,
            customer_name,
            customer_phone,
            customer_email,
            order_type,
            delivery_address,
            subtotal,
            status
          ) VALUES (
            v_order_ref,
            v_user_id,
            COALESCE(p_customer_name, ''),
            COALESCE(p_customer_phone, ''),
            COALESCE(p_customer_email, ''),
            v_order_type,
            COALESCE(p_delivery_address, ''),
            v_subtotal,
            'placed'
          ) RETURNING id, created_at INTO v_order_id, v_created_at;
          EXIT;
        END IF;
    END;
  END LOOP;

  -- 7. Insert Verified Order Line Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_verified_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total
    ) VALUES (
      v_order_id,
      v_item->>'product_id',
      v_item->>'product_name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'line_total')::NUMERIC
    );
  END LOOP;

  -- 8. Insert Payment Record (Simulated Demo Payment)
  v_payment_status := CASE WHEN v_pay_method = 'online' THEN 'paid' ELSE 'pending' END;
  v_txn_ref := (CASE WHEN v_pay_method = 'online' THEN 'TXN-ONL' ELSE 'COD' END)
               || '-' || REPLACE(v_order_ref, 'BB-DEMO-', '')
               || '-' || LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0');

  INSERT INTO public.payments (
    order_id,
    user_id,
    payment_method,
    payment_status,
    amount,
    currency,
    transaction_ref
  ) VALUES (
    v_order_id,
    v_user_id,
    v_pay_method,
    v_payment_status,
    v_subtotal,
    v_currency,
    v_txn_ref
  ) RETURNING id INTO v_payment_id;

  -- 9. Return Complete Verified Order Payload
  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_reference', v_order_ref,
    'user_id', v_user_id,
    'created_at', v_created_at,
    'status', 'placed',
    'customer_name', COALESCE(p_customer_name, ''),
    'customer_phone', COALESCE(p_customer_phone, ''),
    'customer_email', COALESCE(p_customer_email, ''),
    'order_type', v_order_type,
    'delivery_address', COALESCE(p_delivery_address, ''),
    'subtotal', v_subtotal,
    'currency', v_currency,
    'items', v_verified_items,
    'payment', jsonb_build_object(
      'id', v_payment_id,
      'payment_method', v_pay_method,
      'payment_status', v_payment_status,
      'amount', v_subtotal,
      'currency', v_currency,
      'transaction_ref', v_txn_ref,
      'created_at', v_created_at
    )
  );
END;
$$;

-- 2. Grant Execution Permissions to Authenticated Users
GRANT EXECUTE ON FUNCTION public.create_verified_order(JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
