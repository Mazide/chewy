import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../domain/meal_entry.dart';
import '../state/meal_notifier.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meals = ref.watch(mealNotifierProvider);
    final isAnalyzing = ref.watch(isAnalyzingProvider);
    final lastMeal = meals.isEmpty ? null : meals.last;

    final Color bgColor;
    final String label;

    if (isAnalyzing) {
      bgColor = const Color(0xFF444444);
      label = '';
    } else if (lastMeal == null) {
      bgColor = const Color(0xFF555555);
      label = 'No meals yet';
    } else if (lastMeal.status == MealStatus.healthy) {
      bgColor = const Color(0xFF4CAF50);
      label = 'Healthy';
    } else {
      bgColor = const Color(0xFFE53935);
      label = 'Unhealthy';
    }

    return Stack(
      children: [
        Center(
          child: Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Center(
              child: isAnalyzing
                  ? const CircularProgressIndicator(color: Colors.white70)
                  : Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
        ),
        Positioned(
          right: 24,
          bottom: 24,
          child: GestureDetector(
            onTap: isAnalyzing ? null : () => _takePicture(ref),
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: isAnalyzing
                    ? const Color(0xFF555555)
                    : const Color(0xFF333333),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.camera_alt,
                color: Colors.white,
                size: 28,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _takePicture(WidgetRef ref) async {
    if (Platform.isLinux || Platform.isWindows || Platform.isMacOS) {
      ref.read(mealNotifierProvider.notifier).addMeal('/tmp/fake_meal.jpg');
    } else {
      final picker = ImagePicker();
      final photo = await picker.pickImage(source: ImageSource.camera);
      if (photo != null) {
        ref.read(mealNotifierProvider.notifier).addMeal(photo.path);
      }
    }
  }
}
