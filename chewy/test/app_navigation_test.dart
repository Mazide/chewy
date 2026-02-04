import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:chewy/app/app.dart';

void main() {
  testWidgets('App navigation and actions work', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: App()));

    expect(find.byKey(const Key('home-screen')), findsOneWidget);

    await tester.tap(find.byKey(const Key('nav-book')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('book-screen')), findsOneWidget);

    await tester.tap(find.byKey(const Key('nav-weight')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('weight-screen')), findsOneWidget);

    await tester.tap(find.byKey(const Key('settings-action')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('settings-screen')), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('weight-screen')), findsOneWidget);

    await tester.tap(find.byKey(const Key('add-plate-action')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('add-plate-screen')), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('weight-screen')), findsOneWidget);
  });
}

