// Package store persists notebooks on the filesystem (v1). Notebooks are kept
// as opaque .ipynb bytes (the TS NotebookService owns all parsing) plus a small
// JSON sidecar for listing + publication and runtime profile metadata. The Store interface is the
// seam a Postgres implementation slots into later.
package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"time"
)

var ErrNotFound = errors.New("notebook not found")

// slug is part of a filesystem path, so keep it strictly safe.
var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

func ValidSlug(slug string) bool { return slugPattern.MatchString(slug) }

type Meta struct {
	Slug           string `json:"slug"`
	Title          string `json:"title"`
	UpdatedAt      string `json:"updatedAt"`
	Published      bool   `json:"published"`
	RuntimeProfile string `json:"runtimeProfile"`
}

const DefaultRuntimeProfile = "data-science"

func ValidRuntimeProfile(profile string) bool {
	return profile == "data-science" || profile == "ml-cpu"
}

type Store interface {
	Save(slug string, notebook []byte, title string, published bool, runtimeProfile string) (Meta, error)
	Load(slug string) ([]byte, Meta, error)
	List() ([]Meta, error)
	Delete(slug string) error
}

type FSStore struct {
	dir string
}

func NewFSStore(dir string) (*FSStore, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &FSStore{dir: dir}, nil
}

func (s *FSStore) notebookPath(slug string) string {
	return filepath.Join(s.dir, slug+".ipynb")
}
func (s *FSStore) metaPath(slug string) string {
	return filepath.Join(s.dir, slug+".meta.json")
}

func (s *FSStore) Save(slug string, notebook []byte, title string, published bool, runtimeProfile string) (Meta, error) {
	if runtimeProfile == "" {
		runtimeProfile = DefaultRuntimeProfile
	}
	meta := Meta{
		Slug:           slug,
		Title:          title,
		UpdatedAt:      time.Now().UTC().Format(time.RFC3339),
		Published:      published,
		RuntimeProfile: runtimeProfile,
	}
	if err := os.WriteFile(s.notebookPath(slug), notebook, 0o644); err != nil {
		return Meta{}, err
	}
	metaBytes, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return Meta{}, err
	}
	if err := os.WriteFile(s.metaPath(slug), metaBytes, 0o644); err != nil {
		return Meta{}, err
	}
	return meta, nil
}

func (s *FSStore) Load(slug string) ([]byte, Meta, error) {
	notebook, err := os.ReadFile(s.notebookPath(slug))
	if errors.Is(err, os.ErrNotExist) {
		return nil, Meta{}, ErrNotFound
	}
	if err != nil {
		return nil, Meta{}, err
	}
	meta := Meta{Slug: slug, Published: true, RuntimeProfile: DefaultRuntimeProfile}
	if metaBytes, err := os.ReadFile(s.metaPath(slug)); err == nil {
		_ = json.Unmarshal(metaBytes, &meta)
	}
	if meta.RuntimeProfile == "" {
		meta.RuntimeProfile = DefaultRuntimeProfile
	}
	return notebook, meta, nil
}

func (s *FSStore) List() ([]Meta, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	var out []Meta
	for _, e := range entries {
		name := e.Name()
		if filepath.Ext(name) != ".ipynb" {
			continue
		}
		slug := name[:len(name)-len(".ipynb")]
		if _, meta, err := s.Load(slug); err == nil {
			out = append(out, meta)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].UpdatedAt > out[j].UpdatedAt
	})
	return out, nil
}

func (s *FSStore) Delete(slug string) error {
	if err := os.Remove(s.notebookPath(slug)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	_ = os.Remove(s.metaPath(slug))
	return nil
}
