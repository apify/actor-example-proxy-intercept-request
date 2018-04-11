module.exports = {
    "extends": "airbnb-base",
    "plugins": [
        "import"
    ],
    "globals": {
      "document": true,
      "window": true,
    },
    "rules": {
      "no-underscore-dangle": 0,
      "prefer-destructuring": [
        "error",
        {
          "VariableDeclarator": {
            "array": false,
            "object": true
          },
          "AssignmentExpression": {
            "array": false,
            "object": true
          }
        },
        {
          "enforceForRenamedProperties": false
        }
      ]
    }
};
