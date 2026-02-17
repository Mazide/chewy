import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/meal_entry.dart';
import '../../../services/mock_analysis_service.dart';

final mockAnalysisServiceProvider = Provider((_) => MockAnalysisService());

final isAnalyzingProvider = StateProvider<bool>((_) => false);

final mealNotifierProvider =
    StateNotifierProvider<MealNotifier, List<MealEntry>>((ref) {
  return MealNotifier(ref);
});

class MealNotifier extends StateNotifier<List<MealEntry>> {
  MealNotifier(this._ref) : super([]);

  final Ref _ref;

  Future<void> addMeal(String imagePath) async {
    _ref.read(isAnalyzingProvider.notifier).state = true;

    final service = _ref.read(mockAnalysisServiceProvider);
    final status = await service.analyze(imagePath);

    final entry = MealEntry(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      date: DateTime.now(),
      imagePath: imagePath,
      status: status,
    );

    state = [...state, entry];
    _ref.read(isAnalyzingProvider.notifier).state = false;
  }
}
