import chalk from "chalk";

export const JSON_PRINT = (j: any) => {
  return "\n" + JSON.stringify(j, null, 2) + "\n";
};

export const info = (TAG: string) => {
  return (...args: any[]) => {
    console.log(
      chalk.magenta(new Date().toISOString() + "\t"),
      chalk.bgBlue("INFO"),
      "    ",
      chalk.bgGray(TAG),
      ...args.map((arg) => chalk.blue(arg))
    );
  };
};
export const success = (TAG: string) => {
  return (...args: any[]) => {
    console.log(
      chalk.magenta(new Date().toISOString() + "\t"),
      chalk.bgGreen("SUCCESS"),
      "    ",
      chalk.bgGray(TAG),
      ...args.map((arg) => chalk.green(arg))
    );
  };
};
export const warn = (TAG: string) => {
  return (...args: any[]) => {
    console.log(
      chalk.magenta(new Date().toISOString() + "\t"),
      chalk.bgYellow("WARN"),
      "    ",
      chalk.bgGray(TAG),
      ...args.map((arg) => chalk.yellow(arg))
    );
  };
};
export const error = (TAG: string) => {
  return (...args: any[]) => {
    console.log(
      chalk.magenta(new Date().toISOString() + "\t"),
      chalk.bgRed("ERROR"),
      "    ",
      chalk.bgGray(TAG),
      ...args.map((arg) => chalk.red(arg))
    );
  };
};
