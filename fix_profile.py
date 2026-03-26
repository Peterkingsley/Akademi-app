import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Remove title and rightAction from Screen
content = content.replace('title="Profile"', '')
content = content.replace('''      rightAction={
        <TouchableOpacity onPress={() => {}} style={styles.settingsIcon}>
          <Settings size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      }''', '')

# 2. Add buttons to heroSection
old_hero_end = '''            </View>
          )}
        </View>'''

new_hero_end = '''            </View>
          )}

          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.navigate("Sessions")}
              activeOpacity={0.7}
            >
              <Clock size={16} color={colors.primary} />
              <Text style={styles.heroButtonText}>Sessions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.navigate("Progress")}
              activeOpacity={0.7}
            >
              <BarChart2 size={16} color={colors.primary} />
              <Text style={styles.heroButtonText}>Progress</Text>
            </TouchableOpacity>
          </View>
        </View>'''

if old_hero_end in content:
    content = content.replace(old_hero_end, new_hero_end)
else:
    # Try with direct answer?
    pass

# 3. Add styles
old_styles_end = '});'
new_styles = '''  heroButtons: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroButtonText: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: colors.textPrimary,
  },
});'''

if old_styles_end in content:
    # Replace the last occurrence
    parts = content.rsplit(old_styles_end, 1)
    content = new_styles.join(parts)

# 4. Ensure BarChart2 is imported from lucide-react-native
if 'BarChart2' not in content:
    content = content.replace('Bell,', 'Bell, BarChart2,')

with open(file_path, 'w') as f:
    f.write(content)
print("Updated ProfileScreen.tsx")
