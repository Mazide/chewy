void assertNoCaloriesText(String value) {
  final forbidden = RegExp(r'\b(calorie|calories|kcal|macro|macros)\b',
      caseSensitive: false);
  if (forbidden.hasMatch(value)) {
    throw ArgumentError.value(
      value,
      'value',
      'Text contains calorie-related terms.',
    );
  }
}

