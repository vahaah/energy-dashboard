import {
  createLoader,
  createSearchParamsCache,
  createSerializer,
} from "nuqs/server";
import { dashboardSearchParamParsers } from "@/lib/dashboard-search-params";

export const dashboardSearchParamsCache = createSearchParamsCache(
  dashboardSearchParamParsers
);

export const loadDashboardSearchParams = createLoader(
  dashboardSearchParamParsers
);

export const serializeDashboardSearchParams = createSerializer(
  dashboardSearchParamParsers
);
