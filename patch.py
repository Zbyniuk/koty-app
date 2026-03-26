file_path = 'app/cat-documents/[id].tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Dodaj resetModal po uploadDocument
reset_modal_func = '''
  const resetModal = () => {
    setModalVisible(false);
    setSelectedDocType(null);
    setSelectedFile(null);
  };'''

# Znajdź koniec uploadDocument (szukaj };) i dodaj resetModal po nim
upload_end = content.find('  };\n\n  const deleteDocument')

if upload_end != -1:
    content = content[:upload_end+5] + reset_modal_func + content[upload_end+5:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Dodana funkcja resetModal!")