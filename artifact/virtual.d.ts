/** The files in /prompts, put into the page when it is built (scripts/build-artifact.mjs). */
declare module "virtual:nuskha-prompts" {
  const prompts: Record<string, string>;
  export default prompts;
}
