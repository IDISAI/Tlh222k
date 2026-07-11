package store

import (
	"testing"
)

func TestFSStorePersistsRuntimeProfile(t *testing.T) {
	s, err := NewFSStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	if _, err := s.Save("demo", []byte(`{"nbformat":4}`), "Demo", true, "ml-cpu"); err != nil {
		t.Fatal(err)
	}

	_, meta, err := s.Load("demo")
	if err != nil {
		t.Fatal(err)
	}
	if meta.RuntimeProfile != "ml-cpu" {
		t.Fatalf("RuntimeProfile = %q, want %q", meta.RuntimeProfile, "ml-cpu")
	}
}
