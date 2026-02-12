export const BOARD_W = 30;
export const BOARD_H = 30;

export const SEGMENT_MS = 20_000;

export const BASE_TPS = 11;          // base ticks/sec
export const TPS_PER_SPARK = 0.18;   // speed scaling
export const TPS_PER_CHAIN = 0.05;   // slight ramp as chain grows
export const MAX_TPS = 18;

export const SPARK_POINTS = 10;
export const COMPLETE_BONUS = 200;

export const KEEP_SOLID = 6;         // K = how many last successful segments become walls
export const OCCUPANCY_CAP = 0.38;   // reduce K if walls exceed this ratio

export const START_LEN = 3;
export const SPARKS_ON_BOARD = 1;

export const PHASE_CHARGE = 1;       // how many times you can phase (phase mode)
export const PHASE_MS = 420;         // duration of phase window
