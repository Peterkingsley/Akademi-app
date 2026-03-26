import sys

file_path = 'akademi-frontend/src/screens/auth/OnboardingScreen.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Replace slide2Content with a ScrollView
search_text = '''          <View style={styles.slide2Content}>
            <Text style={styles.slide2Headline}>
              The tutor you always needed.{"\n"}
              <Text style={{ color: colors.primary }}>Finally here.</Text>
            </Text>
            <Text style={styles.slide2Body}>
              Akademi helps you solve assignments, understand topics, and
              prepare for exams — all in one place.
            </Text>

            <View style={styles.slide2Buttons}>
              <Button
                label="Let's go"
                onPress={nextSlide}
                icon={<ArrowRight size={20} color={colors.textPrimary} />}
                style={styles.mainButton}
              />
              <Button
                label="Already have an account?"
                variant="secondary"
                onPress={handleLogin}
                style={styles.secondaryButton}
              />
            </View>
          </View>'''

replace_text = '''          <ScrollView
            style={styles.slide2Content}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.slide2Headline}>
              The tutor you always needed.{"\n"}
              <Text style={{ color: colors.primary }}>Finally here.</Text>
            </Text>
            <Text style={styles.slide2Body}>
              Akademi helps you solve assignments, understand topics, and
              prepare for exams — all in one place.
            </Text>

            <View style={styles.slide2Buttons}>
              <Button
                label="Let's go"
                onPress={nextSlide}
                icon={<ArrowRight size={20} color={colors.textPrimary} />}
                style={styles.mainButton}
              />
              <Button
                label="Already have an account?"
                variant="secondary"
                onPress={handleLogin}
                style={styles.secondaryButton}
              />
            </View>
          </ScrollView>'''

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully updated OnboardingScreen.tsx")
else:
    print("Could not find search text in OnboardingScreen.tsx")
    # Debug: print a portion of the content to see why it failed
    # print(content[content.find('<View style={styles.slide2Content}'):content.find('<View style={styles.slide2Content}')+500])
