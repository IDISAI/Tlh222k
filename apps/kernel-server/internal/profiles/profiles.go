// Package profiles defines runtime profile identifiers shared by persistence,
// broker validation, and Docker image selection.
package profiles

const (
	DataScience = "data-science"
	MLCPU       = "ml-cpu"
	JavaScript  = "javascript"
	CPP         = "cpp"
	Java        = "java"
	Rust        = "rust"
	Go          = "go"
	Julia       = "julia"
)

func Valid(profile string) bool {
	switch profile {
	case DataScience, MLCPU, JavaScript, CPP, Java, Rust, Go, Julia:
		return true
	default:
		return false
	}
}
