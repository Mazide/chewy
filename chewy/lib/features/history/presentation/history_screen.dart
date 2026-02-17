import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/meal_entry.dart';
import '../../home/state/meal_notifier.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meals = ref.watch(mealNotifierProvider);

    if (meals.isEmpty) {
      return const Center(
        child: Text(
          'No meals logged yet',
          style: TextStyle(color: Colors.white54, fontSize: 16),
        ),
      );
    }

    final grouped = _groupByDay(meals);
    final sortedDays = grouped.keys.toList()..sort((a, b) => b.compareTo(a));

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: sortedDays.length,
      itemBuilder: (context, index) {
        final day = sortedDays[index];
        final dayMeals = grouped[day]!;
        return _buildDaySection(day, dayMeals);
      },
    );
  }

  Widget _buildDaySection(String day, List<MealEntry> meals) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            day,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        ...meals.map(_buildMealTile),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _buildMealTile(MealEntry meal) {
    final isHealthy = meal.status == MealStatus.healthy;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF2A2A2A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isHealthy
                  ? const Color(0xFF4CAF50)
                  : const Color(0xFFE53935),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            isHealthy ? 'Healthy' : 'Unhealthy',
            style: const TextStyle(color: Colors.white, fontSize: 16),
          ),
          const Spacer(),
          Text(
            _formatTime(meal.date),
            style: const TextStyle(color: Colors.white38, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Map<String, List<MealEntry>> _groupByDay(List<MealEntry> meals) {
    final map = <String, List<MealEntry>>{};
    for (final meal in meals) {
      final key =
          '${meal.date.year}-${meal.date.month.toString().padLeft(2, '0')}-${meal.date.day.toString().padLeft(2, '0')}';
      map.putIfAbsent(key, () => []).add(meal);
    }
    return map;
  }

  String _formatTime(DateTime dt) {
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
