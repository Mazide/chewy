import 'package:flutter_test/flutter_test.dart';

import 'package:chewy/domain/constants.dart';
import 'package:chewy/domain/no_calories.dart';

void main() {
  test('Portion weights are ordered', () {
    expect(portionWeightS, lessThan(portionWeightM));
    expect(portionWeightM, lessThan(portionWeightL));
  });

  test('Perfect thresholds have expected boundaries', () {
    expect(perfectLife.min, 40);
    expect(perfectLife.max, 60);
    expect(perfectEnergy.min, 17);
    expect(perfectEnergy.max, 33);
    expect(perfectPower.min, 17);
    expect(perfectPower.max, 33);
  });

  test('assertNoCaloriesText throws on forbidden words', () {
    expect(() => assertNoCaloriesText('kcal'), throwsArgumentError);
    expect(() => assertNoCaloriesText('Contains Calories'), throwsArgumentError);
    expect(() => assertNoCaloriesText('macro split'), throwsArgumentError);
  });

  test('assertNoCaloriesText allows safe text', () {
    expect(() => assertNoCaloriesText('Focus on habits.'), returnsNormally);
  });
}

