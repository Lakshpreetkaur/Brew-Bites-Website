/**
 * Brew & Bite - Product Catalog Data
 * Contains all signature brews and bakery bites.
 */

const PRODUCTS = [
  {
    id: "mocha-cream",
    name: "Mocha Cream",
    category: "coffee",
    description: "Rich chocolate meets velvety smooth espresso.",
    price: 5.50,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAtSiT_nuRPIxzhj711u9ztYqTFzl0Z4q3f1qZeoxCMm12hYlHJrQPx_1AqNFrrecyeXojJdwdqXzgSR3nRcUB479GqfpmYBN7FB2iPxiUk6BRwGjOTKLg9OuLoBJr3li9iFrleZ6Tzb5sjIwglBYcgJDwZUsMFmj4FNvjNpp61OJ95CaYEu3MUHYlDafF5ixP55sP-ptpitvlUBkcLxTNZdb4qm26_T-0bENJsIz-Js25dN40TPB2NYA",
    accentColor: "bg-tertiary-fixed"
  },
  {
    id: "caramel-latte",
    name: "Caramel Latte",
    category: "coffee",
    description: "Sweet caramel ribbons in a creamy delight.",
    price: 5.00,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDqDTWHE52mfNwiTjNBEw8GXOgnjze1rUxrjvt5p4UijuKmcxfrL5Ouh4cnAfRYXjKWKBVfMSRsRE1G7LsiMzGWQ4KVYPg5yXZytNpJKpteFErIrYQ54vgNccelNal4gpXIvChDxZ3J3oA3-IDhm7O6BCVt1w21NFrjszlqF-MX9m5w_VzpjFjVQHVoONMDXAJa9g9CvaGqoZgSH3QYQSTvHLI0g8MyaBq-Dq9kpW_OcBl9MNsWVMTCrQ",
    accentColor: "bg-secondary-fixed"
  },
  {
    id: "vanilla-cream",
    name: "Vanilla Cream",
    category: "coffee",
    description: "Classic vanilla bean infused for maximum chill.",
    price: 4.50,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBoaLrYFOPEhOmL8osLHUKp52_5DbHhKfnrNc-RoPw-0aoNEcMqXPDBrAYfIFuGKom6Q0ri3hzYuz63mjl3aWIMUA8PIG4QYEt-C-MFBQhdhbDYMXGTUYM2rEThpNZvfLAQUUDCmFZPaXycZRDFR0xfo1a9w6CP0tT-IxV6_fZOzNc8m5_mHNl8CqOL-KBdnk4xHJcRtnGfEfRfWEtg_8uvI850aepHiJJTkA3ePlwZ6IDtSIYi5OxM5Q",
    accentColor: "bg-primary-fixed"
  },
  {
    id: "chocolate-croissant",
    name: "Chocolate Croissant",
    category: "bites",
    description: "Flaky, buttery, filled with dark chocolate.",
    price: 4.00,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCLKhoQuUwFMcB6cvwqpvy3l01CLRMOQ023hE2yalcGxkf6NoPB_U-ItebPRcs4Xafj_RT8Z9sPUN9gPOX3AJDDI9gdGpmzymvjXSk8Lo3lvvQtVQ3mW9uyAsWg5DD6yJW4N6OnfHArvRcDKat_o2zGlDjO_c4msJNaC_Ofvbc7F2EjTnRI1uIOXO3v19aK4jiIEv8fK_yhnsptodn8fsEPY8bf5ByjLzR62ajmzkC3bbL4eDFYvtOPQA",
    accentColor: "bg-secondary-fixed-dim"
  },
  {
    id: "almond-brownie",
    name: "Almond Brownie",
    category: "bites",
    description: "Fudgy core, crispy edges, toasted almonds.",
    price: 3.50,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDubHxFP4arUQjOLfJ0FobeamSV2EaJDg-zT_-FUeyTNJ2L_zeK2pSUeFn9NjjLLxj4n4eBPOxRua-FBVnSHhvvkCrYycX_9PS-udUjwaqjLLqncbs-Xd5nY7-HOv0-pqO7vy3vP-2hAcEVkYEFnuWkwlVofoUSnH5nAhs6GH8-zQlew0KpjAQadJq0LQNfwG7CJTSwpE9DqxqJjNyQDcsryoMzNO5VkcBeKyQq67fjJ8UWz3apNT2KeA",
    accentColor: "bg-tertiary-fixed-dim"
  }
];

// If running in a Node environment (testing/build), export the catalog
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PRODUCTS };
}
