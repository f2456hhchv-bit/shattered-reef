// The shipwright (One Piece's bar: the ship is one of the crew). Every harbourmaster's board has a Shipyard tab
// where you refit your sloop part by part with what you've gathered, smelted and hunted: five refits each for the
// hull, the sails, the guns and the plating. A refit is for good: it's the same ship, only better.

export type ShipPart = 'hull' | 'sails' | 'guns' | 'plating';
export interface ShipTier { name: string; sailing: number; coins: number; items: { id: string; qty: number }[]; /** the part's bonus at this refit, in % */ v: number }
export interface ShipPartDef { name: string; what: string; tiers: ShipTier[] }

export const SHIPYARD: Record<ShipPart, ShipPartDef> = {
  hull: { name: 'Hull', what: 'more hull to lose before you\'re towed home', tiers: [
    { name: 'Sea-oak ribs', sailing: 5, coins: 500, items: [{ id: 'logs_oak', qty: 40 }, { id: 'bar_bronze', qty: 10 }], v: 10 },
    { name: 'Willow-planked', sailing: 20, coins: 3000, items: [{ id: 'logs_willow', qty: 60 }, { id: 'bar_steel', qty: 15 }], v: 20 },
    { name: 'Amber-caulked', sailing: 35, coins: 12000, items: [{ id: 'logs_amber', qty: 80 }, { id: 'bar_storm', qty: 20 }, { id: 'resin', qty: 20 }], v: 35 },
    { name: 'Ghost-yew keel', sailing: 50, coins: 40000, items: [{ id: 'logs_yew', qty: 100 }, { id: 'bar_tide', qty: 25 }], v: 50 },
    { name: 'Leviathan cedar', sailing: 65, coins: 120000, items: [{ id: 'logs_cedar', qty: 120 }, { id: 'bar_levi', qty: 30 }], v: 70 },
  ] },
  sails: { name: 'Sails', what: 'faster under way', tiers: [
    { name: 'Patched canvas', sailing: 5, coins: 400, items: [{ id: 'leather', qty: 15 }], v: 4 },
    { name: 'Silk-stitched', sailing: 20, coins: 2500, items: [{ id: 'spider_silk', qty: 20 }, { id: 'leather', qty: 20 }], v: 8 },
    { name: 'Weaver-silk', sailing: 35, coins: 10000, items: [{ id: 'spider_silk', qty: 40 }, { id: 'resin', qty: 20 }], v: 12 },
    { name: 'Skyglass-cringled', sailing: 50, coins: 35000, items: [{ id: 'spider_silk', qty: 60 }, { id: 'bar_sky', qty: 10 }], v: 16 },
    { name: 'Starbark spars', sailing: 65, coins: 100000, items: [{ id: 'spider_silk', qty: 100 }, { id: 'logs_star', qty: 40 }], v: 20 },
  ] },
  guns: { name: 'Guns', what: 'broadsides hit harder', tiers: [
    { name: 'Iron carronades', sailing: 5, coins: 600, items: [{ id: 'bar_iron', qty: 20 }], v: 8 },
    { name: 'Steel long guns', sailing: 20, coins: 3500, items: [{ id: 'bar_steel', qty: 30 }], v: 16 },
    { name: 'Stormsilver bores', sailing: 35, coins: 14000, items: [{ id: 'bar_storm', qty: 40 }, { id: 'fire_barrel', qty: 10 }], v: 25 },
    { name: 'Cinderite chambers', sailing: 50, coins: 45000, items: [{ id: 'bar_cinder', qty: 40 }], v: 35 },
    { name: 'Orichalcum battery', sailing: 65, coins: 130000, items: [{ id: 'bar_ori', qty: 30 }], v: 45 },
  ] },
  plating: { name: 'Plating', what: 'less damage from every hit', tiers: [
    { name: 'Bronze sheathing', sailing: 5, coins: 500, items: [{ id: 'bar_bronze', qty: 30 }], v: 5 },
    { name: 'Iron bands', sailing: 20, coins: 3000, items: [{ id: 'bar_iron', qty: 40 }], v: 10 },
    { name: 'Abyssite scales', sailing: 35, coins: 12000, items: [{ id: 'bar_abyss', qty: 30 }], v: 15 },
    { name: 'Skyglass bulwarks', sailing: 50, coins: 40000, items: [{ id: 'bar_sky', qty: 40 }], v: 20 },
    { name: 'Leviathite armour', sailing: 65, coins: 120000, items: [{ id: 'bar_levi', qty: 40 }], v: 25 },
  ] },
};
export const SHIP_PARTS = Object.keys(SHIPYARD) as ShipPart[];
