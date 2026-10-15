import { z } from "zod";
import { httpUrlSchema, instantSchema } from "@/lib/catalogue/schema";
import {
  CONVERSION_STATEMENT,
  KTOE_DECIMALS,
  KTOE_TO_TWH_FACTOR,
  TOE_KWH,
} from "@/lib/whole-energy/convert";
import { BALANCE_COLUMNS, ROW_ROLES, ROW_SPEC } from "@/lib/whole-energy/spec";

const ktoeString = z.string().regex(/^-?\d+\.\d{2}$/);

const cellsSchema = z
  .object({
    coal: ktoeString,
    manufactured_fuel: ktoeString,
    primary_oils: ktoeString,
    petroleum_products: ktoeString,
    natural_gas: ktoeString,
    bioenergy_waste: ktoeString,
    primary_electricity: ktoeString,
    electricity: ktoeString,
    heat_sold: ktoeString,
    total: ktoeString,
  })
  .strict();

const rowSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    source_label: z.string().min(1),
    role: z.enum(ROW_ROLES),
    ktoe: cellsSchema,
  })
  .strict();

export const wholeEnergyEditionSchema = z
  .object({
    edition: z.string().min(1),
    table: z.literal("1.1"),
    year: z.number().int(),
    published_at: instantSchema,
    download_url: httpUrlSchema,
    extract_sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    bytes: z.number().int().positive(),
    geography: z.literal("UK"),
    basis: z.literal("gross calorific values"),
    source_unit: z.literal("ktoe"),
    unit: z.literal("TWh"),
    conversion: z
      .object({
        toe_kwh: z.literal(TOE_KWH),
        factor_twh_per_ktoe: z.literal(KTOE_TO_TWH_FACTOR),
        ktoe_decimals: z.literal(KTOE_DECIMALS),
        display_quantum_twh: z.literal("0.1"),
        statement: z.literal(CONVERSION_STATEMENT),
      })
      .strict(),
    rows: z.array(rowSchema).length(ROW_SPEC.length),
  })
  .strict()
  .superRefine((edition, context) => {
    edition.rows.forEach((row, index) => {
      const spec = ROW_SPEC[index];
      if (!spec || row.id !== spec.id || row.role !== spec.role || row.label !== spec.label) {
        context.addIssue({
          code: "custom",
          message: `row ${index} does not match the DUKES 1.1 spec`,
          path: ["rows", index],
        });
      }
    });
    const ids = new Set(edition.rows.map((row) => row.id));
    if (ids.size !== edition.rows.length) {
      context.addIssue({ code: "custom", message: "duplicate balance row id", path: ["rows"] });
    }
    for (const column of BALANCE_COLUMNS) {
      if (!Object.hasOwn(edition.rows[0]?.ktoe ?? {}, column)) {
        context.addIssue({ code: "custom", message: `missing ${column}`, path: ["rows"] });
      }
    }
  });

export type WholeEnergyEdition = z.infer<typeof wholeEnergyEditionSchema>;
export type WholeEnergyRow = WholeEnergyEdition["rows"][number];

export function parseWholeEnergyEdition(value: unknown): WholeEnergyEdition {
  return wholeEnergyEditionSchema.parse(value);
}
