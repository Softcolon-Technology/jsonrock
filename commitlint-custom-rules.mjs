const customRules = {
  "header-pattern": (parsed, _when, value) => {
    const { header } = parsed;
    const regex = new RegExp(value);

    if (!regex.test(header)) {
      return [
        false,
        "Commit message must start with ticket name that is included in the Jira ticket",
      ];
    }

    return [true];
  },
};

export default customRules;

