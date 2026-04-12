import type {
	EvaluatedSheetState,
	SheetDocument,
	SheetFieldValue,
	SheetFormulaIssue,
	SheetModule,
} from "@/types/sheets";
import { isFieldModule } from "@/types/sheets";

const ALLOWED_FUNCTIONS = new Set(["floor", "ceil", "round", "min", "max", "abs"]);

function toNumber(value: SheetFieldValue | undefined) {
	if (typeof value === "number") return value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "string") {
		if (value.trim() === "") return 0;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function getDefaultValue(module: SheetModule): SheetFieldValue | undefined {
	if (module.type === "text" || module.type === "textarea") {
		return module.props.defaultValue;
	}
	if (module.type === "checkbox") {
		return module.props.defaultChecked;
	}
	return undefined;
}

function getFormula(module: SheetModule) {
	if (module.type === "text" || module.type === "textarea") {
		return module.props.formula.trim();
	}
	return "";
}

function getFieldKey(module: SheetModule) {
	if (!isFieldModule(module)) return "";
	return module.props.fieldKey.trim();
}

function sanitizeFormula(formula: string) {
	if (!formula.trim()) return { valid: true, prepared: "" };
	const stripped = formula.replace(/\s+/g, "");
	if (!/^[A-Za-z0-9_+\-*/()., ]+$/.test(stripped)) {
		return { valid: false, prepared: "" };
	}
	return { valid: true, prepared: formula };
}

function compileFormula(
	formula: string,
	dependencies: string[],
): (
	resolver: (fieldKey: string) => number,
	floor: typeof Math.floor,
	ceil: typeof Math.ceil,
	round: typeof Math.round,
	min: typeof Math.min,
	max: typeof Math.max,
	abs: typeof Math.abs,
) => number {
	let expression = formula;
	for (const dependency of dependencies.sort((a, b) => b.length - a.length)) {
		const pattern = new RegExp(`\\b${dependency}\\b`, "g");
		expression = expression.replace(pattern, `resolver("${dependency}")`);
	}

	return new Function(
		"resolver",
		"floor",
		"ceil",
		"round",
		"min",
		"max",
		"abs",
		`return (${expression});`,
	) as (
		resolver: (fieldKey: string) => number,
		floor: typeof Math.floor,
		ceil: typeof Math.ceil,
		round: typeof Math.round,
		min: typeof Math.min,
		max: typeof Math.max,
		abs: typeof Math.abs,
	) => number;
}

export function evaluateSheetDocument(document: SheetDocument): EvaluatedSheetState {
	const values: Record<string, SheetFieldValue> = {};
	const issues: SheetFormulaIssue[] = [];
	const fieldModules = document.modules.filter(isFieldModule);
	const fieldMap = new Map(fieldModules.map((module) => [module.props.fieldKey.trim(), module]));

	for (const module of fieldModules) {
		const fieldKey = getFieldKey(module);
		if (!fieldKey) continue;
		values[fieldKey] =
			document.values[fieldKey] ??
			getDefaultValue(module) ??
			(module.type === "checkbox" ? false : "");
	}

	const resolving = new Set<string>();
	const resolved = new Set<string>();

	const resolve = (fieldKey: string): SheetFieldValue => {
		if (resolved.has(fieldKey)) {
			return values[fieldKey];
		}

		const module = fieldMap.get(fieldKey);
		if (!module) {
			return values[fieldKey] ?? 0;
		}

		const formula = getFormula(module);
		if (!formula) {
			resolved.add(fieldKey);
			return values[fieldKey];
		}

		if (resolving.has(fieldKey)) {
			issues.push({
				fieldKey,
				message: `Circular formula detected for "${fieldKey}".`,
			});
			return values[fieldKey];
		}

		const sanitized = sanitizeFormula(formula);
		if (!sanitized.valid) {
			issues.push({
				fieldKey,
				message: `Formula for "${fieldKey}" contains unsupported characters.`,
			});
			resolved.add(fieldKey);
			return values[fieldKey];
		}

		const tokens = Array.from(
			new Set(formula.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? []),
		);
		const dependencies = tokens.filter(
			(token) => !ALLOWED_FUNCTIONS.has(token) && token !== fieldKey,
		);

		if (tokens.some((token) => !ALLOWED_FUNCTIONS.has(token) && !fieldMap.has(token))) {
			const missing = tokens.find(
				(token) => !ALLOWED_FUNCTIONS.has(token) && !fieldMap.has(token),
			);
			issues.push({
				fieldKey,
				message: `Formula for "${fieldKey}" references missing field "${missing}".`,
			});
			resolved.add(fieldKey);
			return values[fieldKey];
		}

		try {
			resolving.add(fieldKey);
			const runner = compileFormula(formula, dependencies);
			const result = runner(
				(dependency) => toNumber(resolve(dependency)),
				Math.floor,
				Math.ceil,
				Math.round,
				Math.min,
				Math.max,
				Math.abs,
			);
			resolving.delete(fieldKey);

			if (!Number.isFinite(result)) {
				throw new Error("Formula did not resolve to a finite number");
			}

			values[fieldKey] = result;
			resolved.add(fieldKey);
			return result;
		} catch (error) {
			resolving.delete(fieldKey);
			issues.push({
				fieldKey,
				message:
					error instanceof Error
						? `Formula for "${fieldKey}" failed: ${error.message}`
						: `Formula for "${fieldKey}" failed.`,
			});
			resolved.add(fieldKey);
			return values[fieldKey];
		}
	};

	for (const module of fieldModules) {
		const fieldKey = getFieldKey(module);
		if (!fieldKey) continue;
		resolve(fieldKey);
	}

	return { values, issues };
}
