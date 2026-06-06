import apiClient from "./apiClient";

/** Fetch the implied-vol surface. params: { s, r, base_vol, skew, curv, term }. */
export const getVolSurface = async (params) => {
  const res = await apiClient.get("/vol/surface", { params });
  return res.data;
};
