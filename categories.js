/* カテゴリの初期設定。idは記録との結び付けに使うため変更しません。 */
(function (root) {
  'use strict';
  const groups = ['副業・事業育成', '仕事・現在の収入', '生活・家事', '健康・運動', '学習', 'その他'];
  const definitions = [
    { id: 'BGM', group: '副業・事業育成' },
    { id: '英語', group: '学習' },
    { id: '水引', group: '副業・事業育成' },
    { id: 'つまみ細工', group: '副業・事業育成' },
    { id: 'ストレッチ', group: '健康・運動' },
    { id: 'Codex', group: '副業・事業育成' },
    { id: 'お茶講座', group: '副業・事業育成' },
    { id: '動画編集と撮影', label: '動画編集・撮影', aliases: ['動画編集・撮影'], group: '副業・事業育成' },
    { id: 'バイト', group: '仕事・現在の収入' },
    { id: '家事', group: '生活・家事' },
    { id: '買い物', group: '生活・家事' },
    { id: '料理・作り置き', group: '生活・家事' },
    { id: 'ウォーキング', group: '健康・運動' },
    { id: 'その他の運動', group: '健康・運動' },
    { id: 'その他の学習', group: '学習' },
    { id: 'その他', group: 'その他' }
  ];
  const defaults = () => definitions.map((d, order) => ({ id:d.id, label:d.label || d.id, group:d.group, hidden:false, includeToday:true, order }));
  const legacyFind = category => definitions.find(d => d.id === category || d.aliases?.includes(category));
  const find = (category, settings) => {
    const id = legacyFind(category)?.id || category;
    return (Array.isArray(settings) ? settings : defaults()).find(d => d.id === id) || legacyFind(category);
  };
  const api = {
    groups, definitions, defaultSettings: defaults,
    categories: definitions.map(d => d.id),
    groupOf: (category, settings) => find(category, settings)?.group || 'その他',
    categoryLabel: (category, settings) => find(category, settings)?.label || category,
    categoryId: category => legacyFind(category)?.id || category
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.WorkTimerCategories = api;
})(globalThis);
