FROM quay.io/jupyter/minimal-notebook:python-3.12

ARG PROFILE=data-science
ARG TARGETARCH=amd64
ARG DENO_VERSION=2.7.0
ARG XEUS_CLING_VERSION=0.15.3
ARG IJAVA_VERSION=1.3.0
ARG IJAVA_SHA256=484cc62579cb77510b0f0c78283f043794396d8ae9d76a8f2ab5d7368ec246b2
ARG RUST_TOOLCHAIN=1.85.1
ARG EVCXR_VERSION=0.21.1
ARG GOPHERNOTES_VERSION=v0.7.5
ARG JULIA_VERSION=1.12.6
ARG IJULIA_VERSION=1.34.4

USER root
COPY runtime/requirements-jupyter-runtime.txt runtime/requirements-data-science.txt runtime/requirements-ml-cpu.txt /tmp/notebook-requirements/
RUN python -m venv /opt/notebook-env \
    && /opt/notebook-env/bin/python -m pip install --no-cache-dir --upgrade pip \
    && /opt/notebook-env/bin/python -m pip install --no-cache-dir -r /tmp/notebook-requirements/requirements-jupyter-runtime.txt \
    && case "$PROFILE" in \
      data-science) /opt/notebook-env/bin/python -m pip install --no-cache-dir -r /tmp/notebook-requirements/requirements-data-science.txt ;; \
      ml-cpu) /opt/notebook-env/bin/python -m pip install --no-cache-dir -r /tmp/notebook-requirements/requirements-data-science.txt \
        && /opt/notebook-env/bin/python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.7.0+cpu ;; \
      javascript|cpp|java|rust|go|julia) true ;; \
      *) echo "unsupported PROFILE: $PROFILE" >&2; exit 1 ;; \
    esac \
    && rm -rf /tmp/notebook-requirements

ENV PATH=/opt/notebook-env/bin:/opt/deno/bin:/opt/go/bin:/opt/julia/bin:/opt/rust/cargo/bin:$PATH
ENV JUPYTER_PATH=/opt/notebook-env/share/jupyter

RUN set -eux; \
    case "$PROFILE" in \
      data-science|ml-cpu) \
        expected_kernel=python3 \
        ;; \
      javascript) \
        apt-get update; \
        apt-get install -y --no-install-recommends ca-certificates curl unzip; \
        case "$TARGETARCH" in \
          amd64) deno_target=x86_64-unknown-linux-gnu ;; \
          arm64) deno_target=aarch64-unknown-linux-gnu ;; \
          *) echo "unsupported TARGETARCH for Deno: $TARGETARCH" >&2; exit 1 ;; \
        esac; \
        deno_archive="deno-${deno_target}.zip"; \
        curl -fsSL -o "/tmp/${deno_archive}" "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/${deno_archive}"; \
        curl -fsSL -o "/tmp/${deno_archive}.sha256sum" "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/${deno_archive}.sha256sum"; \
        cd /tmp; \
        sha256sum --check "${deno_archive}.sha256sum"; \
        mkdir -p /opt/deno/bin; \
        unzip -q "$deno_archive" -d /opt/deno/bin; \
        XDG_DATA_HOME=/opt/notebook-env/share /opt/deno/bin/deno jupyter --install --name deno; \
        expected_kernel=deno \
        ;; \
      cpp) \
        /opt/conda/bin/mamba create --yes --prefix /opt/xeus-cling --channel conda-forge "xeus-cling=${XEUS_CLING_VERSION}"; \
        mkdir -p /opt/notebook-env/share/jupyter/kernels; \
        cp -R /opt/xeus-cling/share/jupyter/kernels/xcpp* /opt/notebook-env/share/jupyter/kernels/; \
        /opt/conda/bin/mamba clean --all --yes; \
        expected_kernel=xcpp17 \
        ;; \
      java) \
        apt-get update; \
        apt-get install -y --no-install-recommends ca-certificates curl openjdk-17-jdk-headless unzip; \
        curl -fsSL -o /tmp/ijava.zip "https://github.com/SpencerPark/IJava/releases/download/v${IJAVA_VERSION}/ijava-${IJAVA_VERSION}.zip"; \
        echo "${IJAVA_SHA256}  /tmp/ijava.zip" | sha256sum --check -; \
        mkdir -p /tmp/ijava; \
        unzip -q /tmp/ijava.zip -d /tmp/ijava; \
        /opt/notebook-env/bin/python /tmp/ijava/install.py --sys-prefix; \
        expected_kernel=java \
        ;; \
      rust) \
        apt-get update; \
        apt-get install -y --no-install-recommends build-essential ca-certificates curl; \
        curl --proto '=https' --tlsv1.2 -fsSL -o /tmp/rustup-init.sh https://sh.rustup.rs; \
        CARGO_HOME=/opt/rust/cargo RUSTUP_HOME=/opt/rust/rustup sh /tmp/rustup-init.sh -y --profile minimal --default-toolchain "$RUST_TOOLCHAIN"; \
        CARGO_HOME=/opt/rust/cargo RUSTUP_HOME=/opt/rust/rustup /opt/rust/cargo/bin/rustup component add rust-src; \
        CARGO_HOME=/opt/rust/cargo RUSTUP_HOME=/opt/rust/rustup /opt/rust/cargo/bin/cargo install --locked --version "$EVCXR_VERSION" evcxr_jupyter; \
        JUPYTER_PATH=/opt/notebook-env/share/jupyter RUSTUP_HOME=/opt/rust/rustup /opt/rust/cargo/bin/evcxr_jupyter --install; \
        rm -rf /opt/rust/cargo/registry /opt/rust/cargo/git; \
        expected_kernel=rust \
        ;; \
      go) \
        apt-get update; \
        apt-get install -y --no-install-recommends ca-certificates golang-go; \
        mkdir -p /opt/go/bin /opt/notebook-env/share/jupyter/kernels/gophernotes; \
        GOBIN=/opt/go/bin GOPATH=/tmp/go-build go install "github.com/gopherdata/gophernotes@${GOPHERNOTES_VERSION}"; \
        cp /tmp/go-build/pkg/mod/github.com/gopherdata/gophernotes@${GOPHERNOTES_VERSION}/kernel/* /opt/notebook-env/share/jupyter/kernels/gophernotes/; \
        sed "s|gophernotes|/opt/go/bin/gophernotes|" /opt/notebook-env/share/jupyter/kernels/gophernotes/kernel.json.in > /opt/notebook-env/share/jupyter/kernels/gophernotes/kernel.json; \
        expected_kernel=gophernotes \
        ;; \
      julia) \
        apt-get update; \
        apt-get install -y --no-install-recommends ca-certificates curl; \
        case "$TARGETARCH" in \
          amd64) julia_path=x64; julia_arch=x86_64 ;; \
          arm64) julia_path=aarch64; julia_arch=aarch64 ;; \
          *) echo "unsupported TARGETARCH for Julia: $TARGETARCH" >&2; exit 1 ;; \
        esac; \
        julia_series="${JULIA_VERSION%.*}"; \
        julia_archive="julia-${JULIA_VERSION}-linux-${julia_arch}.tar.gz"; \
        curl -fsSL -o "/tmp/${julia_archive}" "https://julialang-s3.julialang.org/bin/linux/${julia_path}/${julia_series}/${julia_archive}"; \
        curl -fsSL -o /tmp/julia.sha256 "https://julialang-s3.julialang.org/bin/checksums/julia-${JULIA_VERSION}.sha256"; \
        grep " ${julia_archive}$" /tmp/julia.sha256 > /tmp/julia-archive.sha256; \
        cd /tmp; \
        sha256sum --check julia-archive.sha256; \
        mkdir -p /opt/julia /opt/julia-depot; \
        tar -xzf "$julia_archive" -C /opt/julia --strip-components=1; \
        IJULIA_VERSION="$IJULIA_VERSION" JULIA_DEPOT_PATH=/opt/julia-depot JUPYTER=/opt/notebook-env/bin/jupyter JUPYTER_DATA_DIR=/opt/notebook-env/share/jupyter /opt/julia/bin/julia --startup-file=no -e 'using Pkg; Pkg.add(Pkg.PackageSpec(name="IJulia", version=ENV["IJULIA_VERSION"])); Pkg.precompile()'; \
        julia_kernel="$(find /opt/notebook-env/share/jupyter/kernels -mindepth 1 -maxdepth 1 -type d -name 'julia-*' -print -quit)"; \
        test -n "$julia_kernel"; \
        cp -R "$julia_kernel" /opt/notebook-env/share/jupyter/kernels/julia; \
        expected_kernel=julia \
        ;; \
      *) \
        echo "unsupported PROFILE: $PROFILE" >&2; \
        exit 1 \
        ;; \
    esac; \
    /opt/notebook-env/bin/jupyter kernelspec list --json > /tmp/kernelspecs.json; \
    /opt/notebook-env/bin/python -c 'import json, pathlib, sys; kernels = json.loads(pathlib.Path(sys.argv[2]).read_text())["kernelspecs"]; expected = sys.argv[1]; assert expected in kernels, f"missing kernelspec {expected!r}: {sorted(kernels)}"' "$expected_kernel" /tmp/kernelspecs.json; \
    rm -rf /var/lib/apt/lists/* /tmp/deno-* /tmp/go-build /tmp/ijava /tmp/ijava.zip /tmp/julia* /tmp/kernelspecs.json /tmp/rustup-init.sh

COPY runtime/course_grading.py /opt/course/course_grading.py
RUN chmod 0444 /opt/course/course_grading.py \
    && mkdir -p /home/jovyan/.cache /home/jovyan/.cargo /home/jovyan/.config /home/jovyan/.ipython /home/jovyan/.ivy2 /home/jovyan/.julia /home/jovyan/.jupyter /home/jovyan/.local /home/jovyan/go /home/jovyan/work \
    && chown -R 1000:100 /home/jovyan

ENV PYTHONPATH=/opt/course
ENV RUSTUP_HOME=/opt/rust/rustup
ENV CARGO_HOME=/home/jovyan/.cargo
ENV GOPATH=/home/jovyan/go
ENV JULIA_DEPOT_PATH=/home/jovyan/.julia:/opt/julia-depot
ENV DENO_DIR=/home/jovyan/.cache/deno
USER 1000:100
WORKDIR /home/jovyan

EXPOSE 8888
CMD ["sh", "-c", "mkdir -p /home/jovyan/work && exec /opt/notebook-env/bin/jupyter server --ServerApp.ip=0.0.0.0 --ServerApp.port=8888 --ServerApp.open_browser=False --ServerApp.allow_root=False --ServerApp.token=${JUPYTER_TOKEN:?JUPYTER_TOKEN required} --ServerApp.password='' --ServerApp.root_dir=/home/jovyan/work"]
