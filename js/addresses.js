/**
 * Brew & Bite - Address Book & Delivery Management (addresses.js)
 * Manages customer saved delivery addresses in Supabase public.addresses table,
 * enforces single-default address logic, customer RLS isolation, and fast checkout auto-fill.
 */

let userAddresses = [];
let activeAddressUserId = null;

/**
 * Fetch saved addresses for the authenticated user from Supabase.
 */
async function fetchUserAddresses(userId) {
  if (!userId) {
    userAddresses = [];
    activeAddressUserId = null;
    return [];
  }

  activeAddressUserId = userId;

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn("Notice: addresses table fetch note:", error.message);
        userAddresses = [];
      } else {
        userAddresses = data || [];
      }
    } catch (err) {
      console.warn("Could not fetch addresses from Supabase:", err);
      userAddresses = [];
    }
  }

  return userAddresses;
}

/**
 * In-memory getter for active user's saved addresses.
 */
function getUserAddresses() {
  return Array.isArray(userAddresses) ? userAddresses : [];
}

/**
 * Get active default address or first saved address.
 */
function getDefaultAddress() {
  const addresses = getUserAddresses();
  if (addresses.length === 0) return null;
  return addresses.find(a => a.is_default) || addresses[0];
}

/**
 * Save (create or update) a delivery address in Supabase.
 */
async function saveUserAddress(addressPayload, user) {
  if (!user || !user.id) {
    throw new Error("You must be signed in to save an address.");
  }
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    throw new Error("Database service is unreachable.");
  }

  const isFirstAddress = userAddresses.length === 0;
  const isDefault = addressPayload.is_default !== undefined ? Boolean(addressPayload.is_default) : isFirstAddress;

  // If setting this address as default, unset all existing defaults for this user
  if (isDefault) {
    try {
      await supabaseClient
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
    } catch (e) {
      console.warn("Could not unset previous default addresses:", e);
    }
  }

  const recordPayload = {
    user_id: user.id,
    full_name: addressPayload.full_name?.trim() || '',
    phone: addressPayload.phone?.trim() || '',
    address_line_1: addressPayload.address_line_1?.trim() || '',
    address_line_2: addressPayload.address_line_2?.trim() || '',
    city: addressPayload.city?.trim() || '',
    state: addressPayload.state?.trim() || '',
    postal_code: addressPayload.postal_code?.trim() || '',
    country: addressPayload.country?.trim() || 'India',
    is_default: isDefault,
    updated_at: new Date().toISOString()
  };

  let savedRecord = null;

  if (addressPayload.id) {
    // Update existing address
    const { data, error } = await supabaseClient
      .from('addresses')
      .update(recordPayload)
      .eq('id', addressPayload.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message || "Failed to update address.");
    savedRecord = data;
  } else {
    // Insert new address
    const { data, error } = await supabaseClient
      .from('addresses')
      .insert(recordPayload)
      .select()
      .single();

    if (error) throw new Error(error.message || "Failed to save address.");
    savedRecord = data;
  }

  // Refresh in-memory list
  await fetchUserAddresses(user.id);
  return savedRecord;
}

/**
 * Delete a saved delivery address from Supabase.
 */
async function deleteUserAddress(addressId, user) {
  if (!addressId || !user || !user.id) return;
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

  const { error } = await supabaseClient
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message || "Failed to delete address.");

  // Refresh in-memory list
  await fetchUserAddresses(user.id);
}

/**
 * Designate a specific address as the default.
 */
async function setDefaultUserAddress(addressId, user) {
  if (!addressId || !user || !user.id) return;
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

  // Unset all existing defaults
  await supabaseClient
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', user.id);

  // Set the target address as default
  const { error } = await supabaseClient
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message || "Failed to update default address.");

  // Refresh in-memory list
  await fetchUserAddresses(user.id);
}

/**
 * Clear in-memory address state on sign out.
 */
function clearUserAddresses() {
  userAddresses = [];
  activeAddressUserId = null;
  console.log("User addresses cleared on sign out.");
}

// Exports for Node testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchUserAddresses,
    getUserAddresses,
    getDefaultAddress,
    saveUserAddress,
    deleteUserAddress,
    setDefaultUserAddress,
    clearUserAddresses
  };
}
