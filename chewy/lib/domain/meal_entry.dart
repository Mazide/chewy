enum MealStatus { healthy, unhealthy }

class MealEntry {
  MealEntry({
    required this.id,
    required this.date,
    required this.imagePath,
    required this.status,
  });

  final String id;
  final DateTime date;
  final String imagePath;
  final MealStatus status;
}
