export const EquipmentSlot = [
  "Head",
  "Cape",
  "Amulet",
  "Weapon",
  "Body",
  "Shield",
  "Arms",
  "Legs",
  "Hair",
  "Gloves",
  "Boots",
  "Jaw",
  "Ring",
  "Ammo",
  "Quiver",
] as const;
export type EquipmentSlot = (typeof EquipmentSlot)[number];
