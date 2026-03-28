import { mockDetails } from "../lib/mock-data";

console.log(JSON.stringify({
  seededAt: new Date().toISOString(),
  count: mockDetails.length,
  ids: mockDetails.map((d) => d.id)
}, null, 2));
