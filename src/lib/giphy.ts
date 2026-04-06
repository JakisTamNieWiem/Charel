import { GiphyFetch } from "@giphy/js-fetch-api";

const giphyKey = import.meta.env.VITE_GIPHY_SDK_KEY || "";

export const gf = new GiphyFetch(giphyKey);
