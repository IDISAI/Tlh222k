package profiles

import "testing"

func TestValidRuntimeProfiles(t *testing.T) {
	for _, profile := range []string{
		"data-science",
		"ml-cpu",
		"javascript",
		"cpp",
		"java",
		"rust",
		"go",
		"julia",
	} {
		if !Valid(profile) {
			t.Errorf("Valid(%q) = false", profile)
		}
	}

	for _, profile := range []string{"", "custom", "python", "DATA-SCIENCE"} {
		if Valid(profile) {
			t.Errorf("Valid(%q) = true", profile)
		}
	}
}
