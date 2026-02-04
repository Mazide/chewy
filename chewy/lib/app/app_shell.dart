import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/add_plate/presentation/add_plate_screen.dart';
import '../features/book/presentation/book_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/weight/presentation/weight_screen.dart';

final bottomNavIndexProvider = StateProvider<int>((ref) => 0);

class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(bottomNavIndexProvider);
    final destinations = [
      const _ShellDestination(
        title: 'Home',
        icon: Icons.home_outlined,
        selectedIcon: Icons.home,
        body: HomeScreen(),
      ),
      const _ShellDestination(
        title: 'Book',
        icon: Icons.menu_book_outlined,
        selectedIcon: Icons.menu_book,
        body: BookScreen(),
      ),
      const _ShellDestination(
        title: 'Weight',
        icon: Icons.monitor_weight_outlined,
        selectedIcon: Icons.monitor_weight,
        body: WeightScreen(),
      ),
    ];

    final destination = destinations[index];

    return Scaffold(
      appBar: AppBar(
        title: Text(destination.title),
        actions: [
          IconButton(
            key: const Key('settings-action'),
            tooltip: 'Settings',
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.of(context).pushNamed(SettingsScreen.routeName);
            },
          ),
        ],
      ),
      body: destination.body,
      floatingActionButton: FloatingActionButton(
        key: const Key('add-plate-action'),
        onPressed: () {
          Navigator.of(context).pushNamed(AddPlateScreen.routeName);
        },
        tooltip: 'Add Plate',
        child: const Icon(Icons.add),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        child: Row(
          children: [
            _NavItem(
              key: const Key('nav-home'),
              label: 'Home',
              icon: destinations[0].iconFor(isSelected: index == 0),
              isSelected: index == 0,
              onTap: () => ref.read(bottomNavIndexProvider.notifier).state = 0,
            ),
            _NavItem(
              key: const Key('nav-book'),
              label: 'Book',
              icon: destinations[1].iconFor(isSelected: index == 1),
              isSelected: index == 1,
              onTap: () => ref.read(bottomNavIndexProvider.notifier).state = 1,
            ),
            const Spacer(),
            _NavItem(
              key: const Key('nav-weight'),
              label: 'Weight',
              icon: destinations[2].iconFor(isSelected: index == 2),
              isSelected: index == 2,
              onTap: () => ref.read(bottomNavIndexProvider.notifier).state = 2,
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    super.key,
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = isSelected
        ? Theme.of(context).colorScheme.primary
        : Theme.of(context).colorScheme.onSurfaceVariant;

    return Expanded(
      child: InkResponse(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color),
              const SizedBox(height: 4),
              Text(
                label,
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShellDestination {
  const _ShellDestination({
    required this.title,
    required this.icon,
    required this.selectedIcon,
    required this.body,
  });

  final String title;
  final IconData icon;
  final IconData selectedIcon;
  final Widget body;
  IconData iconFor({required bool isSelected}) {
    return isSelected ? selectedIcon : icon;
  }
}

