export const SHOP_ITEMS = [
  {
    id: "neon-block",
    name: "Neon Block",
    cost: 0,
    color: "#22d3ee",
    headColor: "#86efac",
    shape: "square",
    description: "Balanced starter skin.",
    buffs: {
      speedMultiplier: 1,
      reactionMs: 110,
      edgeWrap: false,
      timeBonusMs: 0,
    },
  },
  {
    id: "cobalt-orb",
    name: "Cobalt Orb",
    cost: 90,
    color: "#60a5fa",
    headColor: "#bfdbfe",
    shape: "circle",
    description: "Faster reaction handling, slightly faster speed.",
    buffs: {
      speedMultiplier: 1.05,
      reactionMs: 65,
      edgeWrap: false,
      timeBonusMs: 500,
    },
  },
  {
    id: "ember-diamond",
    name: "Ember Diamond",
    cost: 140,
    color: "#fb7185",
    headColor: "#fdba74",
    shape: "diamond",
    description: "High speed for score chasing.",
    buffs: {
      speedMultiplier: 1.16,
      reactionMs: 80,
      edgeWrap: false,
      timeBonusMs: -1200,
    },
  },
  {
    id: "verdant-ghost",
    name: "Verdant Ghost",
    cost: 200,
    color: "#34d399",
    headColor: "#bbf7d0",
    shape: "circle",
    description: "Wrap through board edges and gain extra time.",
    buffs: {
      speedMultiplier: 0.96,
      reactionMs: 95,
      edgeWrap: true,
      timeBonusMs: 2500,
    },
  },
];

export const DEFAULT_ITEM_ID = "neon-block";

export function getShopItem(id) {
  return SHOP_ITEMS.find((item) => item.id === id) || SHOP_ITEMS[0];
}

export function getEffectiveLoadout(itemId) {
  const item = getShopItem(itemId);
  return {
    id: item.id,
    name: item.name,
    color: item.color,
    headColor: item.headColor,
    shape: item.shape,
    buffs: { ...item.buffs },
  };
}
