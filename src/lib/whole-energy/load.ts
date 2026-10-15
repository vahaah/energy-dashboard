import rawEdition from "../../../data/catalogue/whole-energy.json";
import { parseWholeEnergyEdition, type WholeEnergyEdition } from "@/lib/whole-energy/schema";

export function loadWholeEnergyEdition(): WholeEnergyEdition {
  return parseWholeEnergyEdition(rawEdition);
}
