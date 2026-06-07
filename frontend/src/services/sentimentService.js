import apiClient from "./apiClient";

/** Analyze earnings-call sentiment + event study. payload: { symbol?, text? }. */
export const analyzeSentiment = async (payload) => {
  const res = await apiClient.post("/sentiment/analyze", payload);
  return res.data;
};
