import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import type { AssetPageModel } from "@/lib/assets/page-model";

/** Register credits for a station page. Link pages already carry their own lines. */
export function withRegisterCredits(model: AssetPageModel, sources: readonly string[]): AssetPageModel {
  if (model.attributions.length > 0) {
    return model;
  }
  const catalogue = cataloguePageSources();
  const credits: string[] = [];
  if (sources.includes("REPD")) {
    const source = catalogue.find((item) => item.id === "desnz-repd");
    if (source) {
      credits.push(source.attribution);
    }
  }
  if (sources.includes("DUKES")) {
    const source = catalogue.find((item) => item.id === "desnz-dukes");
    if (source) {
      credits.push(source.attribution);
    }
  }
  return { ...model, attributions: credits };
}
