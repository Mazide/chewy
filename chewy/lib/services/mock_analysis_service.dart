import 'dart:math';

import '../domain/meal_entry.dart';

class MockAnalysisService {
  final _random = Random();

  Future<MealStatus> analyze(String imagePath) async {
    await Future.delayed(const Duration(seconds: 2));
    return _random.nextBool() ? MealStatus.healthy : MealStatus.unhealthy;
  }
}
