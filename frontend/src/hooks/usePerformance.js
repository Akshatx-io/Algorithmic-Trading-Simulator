import { useEffect, useState } from "react";
import { getPerformance } from "../services/performanceService";

const usePerformance = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const res = await getPerformance();
      setData(res);
    };

    fetch();
  }, []);

  return data;
}

export default usePerformance;