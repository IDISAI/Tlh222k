// Package store persists notebooks on the filesystem (v1). Notebooks are kept
// as opaque .ipynb bytes (the TS NotebookService owns all parsing) plus a small
// JSON sidecar for listing + publication and runtime profile metadata. The Store interface is the
// seam a Postgres implementation slots into later.
package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sync"
	"time"

	"github.com/lh222k/kernel-server/internal/profiles"
)

var ErrNotFound = errors.New("notebook not found")
var ErrCorruptMeta = errors.New("corrupt notebook metadata")

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

const DefaultRuntimeProfile = profiles.DataScience

func ValidRuntimeProfile(profile string) bool {
	return profiles.Valid(profile)
}

type Store interface {
	Save(slug string, notebook []byte, title string, published bool, runtimeProfile string) (Meta, error)
	Load(slug string) ([]byte, Meta, error)
	List() ([]Meta, error)
	Delete(slug string) error
}

type FSStore struct {
	dir string
	mu  sync.RWMutex
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

// writeTemp writes a fully flushed file beside its destination. Keeping the
// temp file in the same directory makes the later rename atomic on the same
// filesystem.
func writeTemp(path string, data []byte) (string, error) {
	f, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return "", err
	}
	tmp := f.Name()
	cleanup := func() {
		_ = f.Close()
		_ = os.Remove(tmp)
	}
	if _, err := f.Write(data); err != nil {
		cleanup()
		return "", err
	}
	if err := f.Chmod(0o644); err != nil {
		cleanup()
		return "", err
	}
	if err := f.Sync(); err != nil {
		cleanup()
		return "", err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}
	return tmp, nil
}

type stagedFile struct {
	path   string
	tmp    string
	backup string
	hadOld bool
}

func reservePath(dir, pattern string) (string, error) {
	f, err := os.CreateTemp(dir, pattern)
	if err != nil {
		return "", err
	}
	path := f.Name()
	if err := f.Close(); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	if err := os.Remove(path); err != nil {
		return "", err
	}
	return path, nil
}

// installPair replaces both files from prepared temps. Existing files are
// moved aside first so a failed second rename can roll back the first one.
func installPair(
	files []stagedFile,
	reserve func(string, string) (string, error),
) error {
	installed := 0
	rollback := func() {
		for i := installed - 1; i >= 0; i-- {
			_ = os.Remove(files[i].path)
		}
		for _, file := range files {
			_ = os.Remove(file.tmp)
			if file.hadOld {
				_ = os.Rename(file.backup, file.path)
			} else if file.backup != "" {
				_ = os.Remove(file.backup)
			}
		}
	}

	for i := range files {
		backup, err := reserve(filepath.Dir(files[i].path), ".backup-*")
		if err != nil {
			rollback()
			return err
		}
		files[i].backup = backup
		if err := os.Rename(files[i].path, backup); err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				rollback()
				return err
			}
		} else {
			files[i].hadOld = true
		}
	}

	for i := range files {
		if err := os.Rename(files[i].tmp, files[i].path); err != nil {
			rollback()
			return err
		}
		installed++
	}
	for _, file := range files {
		if file.backup != "" {
			_ = os.Remove(file.backup)
		}
	}
	return nil
}

func (s *FSStore) Save(slug string, notebook []byte, title string, published bool, runtimeProfile string) (Meta, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

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
	metaBytes, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return Meta{}, err
	}
	notebookTmp, err := writeTemp(s.notebookPath(slug), notebook)
	if err != nil {
		return Meta{}, err
	}
	metaTmp, err := writeTemp(s.metaPath(slug), metaBytes)
	if err != nil {
		_ = os.Remove(notebookTmp)
		return Meta{}, err
	}
	if err := installPair([]stagedFile{
		{path: s.notebookPath(slug), tmp: notebookTmp},
		{path: s.metaPath(slug), tmp: metaTmp},
	}, reservePath); err != nil {
		return Meta{}, err
	}
	return meta, nil
}

func (s *FSStore) Load(slug string) ([]byte, Meta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.loadUnlocked(slug)
}

func (s *FSStore) loadUnlocked(slug string) ([]byte, Meta, error) {
	notebook, err := os.ReadFile(s.notebookPath(slug))
	if errors.Is(err, os.ErrNotExist) {
		return nil, Meta{}, ErrNotFound
	}
	if err != nil {
		return nil, Meta{}, err
	}
	// Missing metadata is treated as a draft. Never infer publication from the
	// notebook file alone: a sidecar is the source of truth for visibility.
	meta := Meta{Slug: slug, Published: false, RuntimeProfile: DefaultRuntimeProfile}
	metaBytes, err := os.ReadFile(s.metaPath(slug))
	if errors.Is(err, os.ErrNotExist) {
		return notebook, meta, nil
	}
	if err != nil {
		return notebook, meta, fmt.Errorf("%w: %v", ErrCorruptMeta, err)
	}
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		return notebook, Meta{Slug: slug, Published: false, RuntimeProfile: DefaultRuntimeProfile}, fmt.Errorf("%w: %v", ErrCorruptMeta, err)
	}
	meta.Slug = slug
	if meta.RuntimeProfile == "" {
		meta.RuntimeProfile = DefaultRuntimeProfile
	}
	return notebook, meta, nil
}

func (s *FSStore) List() ([]Meta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

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
		if _, meta, err := s.loadUnlocked(slug); err != nil {
			return nil, err
		} else {
			out = append(out, meta)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].UpdatedAt > out[j].UpdatedAt
	})
	return out, nil
}

func (s *FSStore) Delete(slug string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.Remove(s.notebookPath(slug)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	_ = os.Remove(s.metaPath(slug))
	return nil
}
