import re

file_path = 'akademi-frontend/src/screens/auth/OnboardingScreen.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Pattern to find the slide2Content View
pattern = r'(<View\s+style=\{styles\.slide2Content\}>.*?<View\s+style=\{styles\.slide2Buttons\}>.*?<Button.*?/>.*?<Button.*?/>.*?</View>)\s*</View>'

def replace_func(match):
    inner_content = match.group(1)
    # Replace the outer View with ScrollView
    new_inner = inner_content.replace('<View style={styles.slide2Content}>',
                                      '<ScrollView \n            style={styles.slide2Content}\n            contentContainerStyle={{ paddingBottom: 40 }}\n            showsVerticalScrollIndicator={false}\n          >')
    return new_inner + '\n          </ScrollView>'

# More targeted replacement
# Let's try finding the start of slide2Content and the matching end tag.
# Since it's the last major block in the second slide.

start_marker = '<View style={styles.slide2Content}>'
end_marker = '</View>\n        </View>\n      </ScrollView>\n    </View>'

if start_marker in content:
    print("Found start marker")
    # We want to replace the View starting with start_marker and its corresponding end tag.
    # The structure is:
    # <View style={styles.slide}>  (Slide 2)
    #   ...
    #   <View style={styles.slide2Content}>
    #     ...
    #   </View>
    # </View>

    # Let's look for the very last </View> before the slide end.

    # Simpler: replace the specific lines.
    lines = content.split('\n')
    new_lines = []
    in_slide2_content = False
    brace_count = 0

    for line in lines:
        if '<View style={styles.slide2Content}>' in line:
            new_lines.append(line.replace('<View style={styles.slide2Content}>',
                '<ScrollView style={styles.slide2Content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>'))
            in_slide2_content = True
            continue

        if in_slide2_content:
            # This is a bit risky if there are multiple </View>s.
            # But based on the file content, the next </View> at the same indentation level is the one.
            if '          </View>' in line and 'styles.slide2Buttons' not in line:
                # We need to be careful. The buttons view is inside.
                # The buttons view starts with <View style={styles.slide2Buttons}>
                pass

        new_lines.append(line)

    # Actually, let's just use a string replace on the known structure.
    # I'll copy-paste the exact lines from the cat output.

    old_block = """          <View style={styles.slide2Content}>
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
          </View>"""

    new_block = """          <ScrollView
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
          </ScrollView>"""

    if old_block in content:
        new_content = content.replace(old_block, new_block)
        with open(file_path, 'w') as f:
            f.write(new_content)
        print("Success")
    else:
        print("Failed to match block")
        # Try a more flexible match?
