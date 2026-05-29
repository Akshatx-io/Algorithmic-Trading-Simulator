// import PriceTicker from "./PriceTicker";

// export default function Topbar() {

//   console.log("Topbar rendered");

//   return (

//     <div style={{ background: "#111", borderBottom: "1px solid #333" }}>

//       <PriceTicker />

//       <div
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           padding: "10px 20px",
//           color: "white",
//         }}
//       >
//         <h2 style={{ margin: 0 }}>ATS HFT Dashboard</h2>
//         <span>Live Trading Terminal</span>
//       </div>

//     </div>

//   );

// }






import PriceTicker from "./PriceTicker";

const Topbar = () => {

  return (
    <div className="bg-gray-900 border-b border-gray-800">

      <PriceTicker />

    </div>
  );
};

export default Topbar;