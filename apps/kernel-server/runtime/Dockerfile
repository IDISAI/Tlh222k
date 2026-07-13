FROM quay.io/jupyter/minimal-notebook:python-3.12

ARG PROFILE=data-science

USER root
COPY runtime/requirements-data-science.txt runtime/requirements-ml-cpu.txt /tmp/notebook-requirements/
RUN case "$PROFILE" in \
      data-science) python -m pip install --no-cache-dir -r /tmp/notebook-requirements/requirements-data-science.txt ;; \
      ml-cpu) python -m pip install --no-cache-dir -r /tmp/notebook-requirements/requirements-data-science.txt \
        && python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.7.0+cpu ;; \
      *) echo "unsupported PROFILE: $PROFILE" >&2; exit 1 ;; \
    esac \
    && rm -rf /tmp/notebook-requirements

COPY runtime/course_grading.py /opt/course/course_grading.py
RUN chmod 0444 /opt/course/course_grading.py

ENV PYTHONPATH=/opt/course
USER 1000:100
WORKDIR /home/jovyan

EXPOSE 8888
CMD ["sh", "-c", "mkdir -p /home/jovyan/work && exec jupyter server --ServerApp.ip=0.0.0.0 --ServerApp.port=8888 --ServerApp.open_browser=False --ServerApp.allow_root=False --ServerApp.token=${JUPYTER_TOKEN:?JUPYTER_TOKEN required} --ServerApp.password='' --ServerApp.root_dir=/home/jovyan/work"]
