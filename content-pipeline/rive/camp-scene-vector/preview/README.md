# Локальный просмотр сцены Rive

Из корня репозитория:

```sh
python3 -m http.server 8771 --bind 127.0.0.1 --directory content-pipeline/rive/camp-scene-vector
```

Открыть [просмотр](http://localhost:8771/preview/). Перед запуском должен
существовать `exports/camp-scene-vector.riv`. Через `file://` WebAssembly
и запрос ассета не работают; используйте локальный сервер.

Просмотр запускает настоящий `.riv`: `CampScene`, `Tent`, `Hero`, `Dog`,
`Campfire`, `Kettle`. У каждого артборда одноимённая state machine.
Можно выбрать объект, остановить/возобновить движение и скачать ассет.
При `prefers-reduced-motion: reduce` первоначально включена пауза.
Скрытая вкладка останавливает отрисовку и возобновляет её только если
пользователь оставил воспроизведение включённым.

Runtime `@rive-app/webgl2` закреплён на **2.40.1**. Оригинальные `rive.js`,
`rive.wasm`, `rive_fallback.wasm`, `package.json` и лицензия MIT находятся в
`vendor/webgl2-2.40.1/`. JS и WASM взяты из одного npm-пакета; оба WASM URL
явно локальные, загрузка с CDN отключена. Зависимости основного прототипа
не менялись. Файл `.riv` не содержит скриптов, поэтому подпись скриптов
Rive для этой пробы не требуется.

Runtime установлен отдельно командой:

```sh
npm install --prefix /tmp/chewy-rive-web --ignore-scripts --no-audit --no-fund --save-exact @rive-app/webgl2@2.40.1
```

Основание реализации: [Web runtime](https://rive.app/docs/runtimes/web/web-js),
[локальный WASM](https://rive.app/docs/runtimes/web/preloading-wasm),
[API playback](https://rive.app/docs/runtimes/web/rive-parameters).
Лицензия: [официальный репозиторий](https://github.com/rive-app/rive-wasm/blob/master/LICENSE).

Это отдельный экран ревью; в основной прототип и iOS он не подключён.

Проверено в Chromium через Playwright: загрузка настоящего `.riv`, движение,
пауза и продолжение, переключение всех шести артбордов и видимость каждого
на паузе, первоначальная пауза при reduced motion, мобильная ширина 390 px.
Внешних запросов и ошибок JavaScript/runtime не было. Для снимков reduced
motion допуск — один уровень цвета на границах растеризации, значимых
изменений пикселей нет. Результаты — `qa.json`, общий вид — `review.png`.
