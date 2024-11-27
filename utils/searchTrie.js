class TrieNode {
  constructor() {
    this.children = {};
    this.isEndOfWord = false;
    this.records = []; // To store records or IDs
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, record) {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children[char]) node.children[char] = new TrieNode();
      node = node.children[char];
    }
    node.isEndOfWord = true;
    node.records.push(record);
  }

  search(prefix) {
    let node = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!node.children[char]) return [];
      node = node.children[char];
    }
    return this._collectAllRecords(node);
  }

  _collectAllRecords(node) {
    const results = [];
    if (node.isEndOfWord) results.push(...node.records);

    for (const char in node.children) {
      results.push(...this._collectAllRecords(node.children[char]));
    }
    return results;
  }
}

const trieMap = new Map();

function initializeTrie(modelName, data) {
  const trie = new Trie();
  data.forEach((item) => {
    Object.values(item).forEach((value) => {
      if (typeof value === 'string') {
        trie.insert(value, item);
      }
    });
  });
  trieMap.set(modelName, trie);
}

module.exports = { Trie, initializeTrie, trieMap };
