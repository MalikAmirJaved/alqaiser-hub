// Public sample videos used as dummy CCTV feeds
const V = {
  bunny: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  elephant: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  blazes: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  escapes: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  fun: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  joyrides: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  meltdowns: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  sintel: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
};

export const employeeFeeds = [
  { id: "e1", name: "Workstation Floor A", location: "Floor 1 – Dev Bay", src: V.bunny },
  { id: "e2", name: "Workstation Floor B", location: "Floor 2 – Design Bay", src: V.fun },
  { id: "e3", name: "Meeting Room 1", location: "Floor 1 – East", src: V.blazes },
  { id: "e4", name: "Break Room", location: "Floor 2 – Pantry", src: V.escapes },
];

export const warehouseFeeds = [
  { id: "w1", name: "Loading Dock", location: "Warehouse A – Bay 1", src: V.joyrides },
  { id: "w2", name: "Storage Aisle 3", location: "Warehouse A – Aisle 3", src: V.meltdowns },
  { id: "w3", name: "Inventory Hall", location: "Warehouse B – Main", src: V.elephant },
  { id: "w4", name: "Dispatch Area", location: "Warehouse A – Exit", src: V.sintel },
];

export const gateFeeds = [
  { id: "g1", name: "Main Gate – Entry", location: "Office HQ – North Gate", src: V.escapes },
  { id: "g2", name: "Main Gate – Exit", location: "Office HQ – North Gate", src: V.blazes },
  { id: "g3", name: "Visitor Parking", location: "Office HQ – East", src: V.fun },
  { id: "g4", name: "Reception Lobby", location: "Office HQ – Ground Floor", src: V.bunny },
];
