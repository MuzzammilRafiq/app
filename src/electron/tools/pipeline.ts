import { getDoorResponse } from "./make_plan.js";
import { router } from "./router.js";

export const pipeline = async (userInput: string) => {
  const { steps, context } = await getDoorResponse(userInput);
  const summary = await router(steps, context);
  return summary;
};
