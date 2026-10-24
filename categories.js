/* 分類を変更するときは、この一覧を編集します。
   idは保存済みカテゴリ名なので維持し、表示名だけ変える場合はlabelを変更します。
   同じ活動の旧名称はaliasesに追加します。未知のカテゴリは「その他」に集計します。 */
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
  const find = category => definitions.find(d => d.id === category || d.aliases?.includes(category));
  const api = {
    groups, definitions,
    categories: definitions.map(d => d.id),
    groupOf: category => find(category)?.group || 'その他',
    categoryLabel: category => find(category)?.label || category,
    categoryId: category => find(category)?.id || category
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.WorkTimerCategories = api;
})(globalThis);
