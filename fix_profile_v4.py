import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# I need to restore the file to a clean state first or use a very targeted replace.
# Let's use a very targeted replace on the return blocks.

loading_block = '''  if (loading && !refreshing) {
    return (
      <Screen
        hideHeader
        scrollable
        style={{ flex: 1 }}
      >'''

new_loading_block = '''  if (loading && !refreshing) {
    return (
      <Screen hideHeader style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }'''

if loading_block in content:
    content = content.replace(loading_block, new_loading_block)

# Fix the main return
main_return = '''  return (
      <Screen
        hideHeader
        scrollable
        style={{ flex: 1 }}
      >
      <ScrollView'''

new_main_return = '''  return (
    <Screen hideHeader scrollable style={{ flex: 1 }}>
      <ScrollView'''

if main_return in content:
    content = content.replace(main_return, new_main_return)

with open(file_path, 'w') as f:
    f.write(content)
