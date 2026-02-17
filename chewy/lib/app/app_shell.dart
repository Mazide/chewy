import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/history/presentation/history_screen.dart';
import '../features/home/presentation/home_screen.dart';

final bottomNavIndexProvider = StateProvider<int>((ref) => 0);

class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  static const _tabs = ['Home', 'History'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(bottomNavIndexProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: index == 0
                  ? const HomeScreen()
                  : const HistoryScreen(),
            ),
            _BottomBar(
              currentIndex: index,
              onTap: (i) =>
                  ref.read(bottomNavIndexProvider.notifier).state = i,
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      color: const Color(0xFF16213E),
      child: Row(
        children: List.generate(AppShell._tabs.length, (i) {
          final isSelected = i == currentIndex;
          return Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onTap(i),
              child: Center(
                child: Text(
                  AppShell._tabs[i],
                  style: TextStyle(
                    color: isSelected ? Colors.white : Colors.white38,
                    fontSize: 14,
                    fontWeight:
                        isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
