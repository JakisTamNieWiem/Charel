import type { UseMutationResult } from "@tanstack/react-query";

export type NamedMutationResult<
	ActionName extends string,
	Result,
	ErrorType,
	Variables,
	ActionVariables = Variables,
	Context = unknown,
> = UseMutationResult<Result, ErrorType, Variables, Context> & {
	[K in ActionName]: (variables: ActionVariables) => Promise<Result>;
};

export function withNamedMutation<
	ActionName extends string,
	Result,
	ErrorType,
	Variables,
	ActionVariables = Variables,
	Context = unknown,
>(
	mutation: UseMutationResult<Result, ErrorType, Variables, Context>,
	actionName: ActionName,
	action: (variables: ActionVariables) => Promise<Result>,
): NamedMutationResult<
	ActionName,
	Result,
	ErrorType,
	Variables,
	ActionVariables,
	Context
> {
	return {
		...mutation,
		[actionName]: action,
	} as NamedMutationResult<
		ActionName,
		Result,
		ErrorType,
		Variables,
		ActionVariables,
		Context
	>;
}
