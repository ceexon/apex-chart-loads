document.addEventListener("alpine:init", () => {
  Alpine.data("charting", () => ({
    isLoading: true,
    title: "Bulk",
    type: "bulk",
    start: 0,
    end: 0,
    duration: 0,
    index: 0,
    lastId: "",
    elements: null,
    animations: true,
    series: [],
    categories: [],
    mountDuration: "",
    currentId: 0,
    multiple: false,
    init() {
      //--- Data Preparation ---
      performance.mark("prepStart");
      const groupIndices = {};
      const series = [];
      const categories = new Set();

      DATA.forEach(({ quantity, month, year, category: group }) => {
        if (groupIndices[group] === undefined) {
          groupIndices[group] = series.length;
          series.push({
            name: group,
            data: [],
          });
        }

        series[groupIndices[group]].data.push(quantity);
        categories.add(`${month} '${year.toString().replace("20", "")}`);
      });

      performance.mark("prepEnd");
      const prepEnd = performance.measure(
        "data-prep-end",
        "prepStart",
        "prepEnd"
      );

      this.series = structuredClone(series);
      this.categories = Array.from(categories);

      console.log("Data preparation took => ", prepEnd.duration);
      // --- End Data Prep ---

      // --- Element Id and cloning ---
      const temp = document.querySelector("template");
      let elI = 0;
      while (temp.content.children.item(0).children.item(elI)) {
        const el = temp.content.children.item(0).children.item(elI);
        el.setAttribute("id", "chart-" + elI);
        elI++;
      }

      this.elements = temp.content.children.item(0).cloneNode(true);
      this.lastId = "chart-" + (this.elements.children.length - 1);
      // console.log(this.lastId, this.elements);
      document
        .querySelector("#chart-wrapper")
        .appendChild(this.elements.cloneNode(true));
      // --- end Element Id and cloning ---

      performance.mark(`charts-start-mount`);
      this.generateNormally();

      this.$watch("animations", () => this.onViewChanged());
      this.$watch("type", () => this.onViewChanged());
      this.$watch("multiple", () => this.onViewChanged());
    },
    onViewChanged() {
      this.isLoading = true;
      this.duration = 0;
      this.mountDuration = 0;
      this.clearCharts();
      setTimeout(() => {
        performance.mark(`charts-start-mount`);
        if (this.type === "bulk") {
          this.generateNormally();
        } else if (this.multiple) {
          for (let index = 0; index < this.elements.children.length; index++) {
            this.multiGenerateSeq(index);
          }
        } else {
          this.generateSeq();
        }
      }, 100);
    },
    generateNormally() {
      this.title = "Bulk Render";
      performance.mark("startBulk");

      const animations = this.animations
        ? {}
        : {
            enabled: false,
            speed: 0,
            animateGradually: {
              enabled: false,
              delay: 0,
            },
            dynamicAnimation: {
              enabled: false,
              speed: 0,
            },
          };

      const options = {
        series: this.series,
        chart: {
          type: "bar",
          height: 350,
          events: {
            animationEnd: (ctx) => {
              if (ctx.el.id === this.lastId) {
                performance.mark(`${ctx.el.id}-end-animation`);
                const p = performance.measure(
                  "animation-end",
                  `charts-start-mount`,
                  `${ctx.el.id}-end-animation`
                );

                performance.clearMarks("charts-start-mount");
                performance.clearMarks(`${ctx.el.id}-end-animation`);
                this.duration = p.duration.toFixed(2);
                this.isLoading = false;
              }
            },
            mounted: (ctx) => {
              if (ctx.el.id === this.lastId) {
                performance.mark(`${ctx.el.id}-end-mount`);
                const p = performance.measure(
                  "mount-end",
                  `charts-start-mount`,
                  `${ctx.el.id}-end-mount`
                );

                if (!this.animations) {
                  performance.clearMarks("charts-start-mount");
                  this.duration = p.duration.toFixed(2) + "ms";
                  this.isLoading = false;
                }
                performance.clearMarks(`${ctx.el.id}-end-mount`);
                this.mountDuration = p.duration.toFixed(2) + "ms";
              }
            },
          },
          animations,
        },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: "55%",
            endingShape: "rounded",
          },
        },
        dataLabels: {
          enabled: false,
        },
        stroke: {
          show: true,
          width: 2,
          colors: ["transparent"],
        },
        xaxis: {
          categories: this.categories,
        },
        yaxis: {
          title: {
            text: "$ (thousands)",
          },
        },
        fill: {
          opacity: 1,
        },
        tooltip: {
          y: {
            formatter: function (val) {
              return "$ " + val + " thousands";
            },
          },
        },
      };

      document.querySelectorAll(".chart").forEach((el, i) => {
        const id = "chart-" + i;
        el.setAttribute("id", id);
        performance.mark(`${id}-start-render`);
        const chart = new ApexCharts(el, options);
        chart.render();
        performance.mark(`${id}-end-render`);
      });
    },
    clearCharts() {
      document
        .querySelector("#chart-wrapper")
        .replaceChildren(this.elements.cloneNode(true));
    },
    // Load a chart at a time
    generateSeq() {
      if (this.currentId >= this.elements.children.length) {
        this.isLoading = false;
        performance.mark(`charts-end-mount`);
        const p = performance.measure(
          "mount-end",
          `charts-start-mount`,
          `charts-end-mount`
        );
        performance.clearMarks("charts-start-mount");
        performance.clearMarks(`charts-end-mount`);
        this.duration = p.duration.toFixed(4) + "ms";
        return;
      }

      let chart;
      // Group 6 months data
      let startIndex = 0;
      let step = 6; // startIndex + step = 6th item index + 1

      const nextSeries = (start) => {
        return this.series.map(({ name, data }) => ({
          name,
          data: data.slice(start, start + step),
        }));
      };

      const nextCategories = (start) => {
        return this.categories.slice(0, start + step);
      };

      const animations = this.animations
        ? {}
        : {
            enabled: false,
            speed: 0,
            animateGradually: {
              enabled: false,
              delay: 0,
            },
            dynamicAnimation: {
              enabled: false,
              speed: 0,
            },
          };

      const options = {
        series: nextSeries(startIndex),
        chart: {
          type: "bar",
          height: 350,
          events: {
            animationEnd: (ctx) => {
              if (startIndex >= this.categories.length) {
                this.currentId += 1;
                this.generateSeq();
                return;
              }

              ctx.updateOptions({
                xaxis: {
                  categories: nextCategories(startIndex),
                },
              });
              ctx.appendData(nextSeries(startIndex));
              startIndex += step;
            },
            mounted: (ctx) => {
              if (!this.animations) {
                if (startIndex >= this.categories.length) {
                  this.currentId += 1;
                  this.generateSeq();
                  return;
                }

                ctx.updateOptions({
                  xaxis: {
                    categories: nextCategories(startIndex),
                  },
                });
                ctx.appendData(nextSeries(startIndex));
                startIndex += step;
              }
            },
          },
          animations,
        },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: "55%",
            endingShape: "rounded",
          },
        },
        dataLabels: {
          enabled: false,
        },
        stroke: {
          show: true,
          width: 2,
          colors: ["transparent"],
        },
        xaxis: {
          categories: nextCategories(startIndex),
        },
        yaxis: {
          title: {
            text: "$ (thousands)",
          },
        },
        fill: {
          opacity: 1,
        },
        tooltip: {
          y: {
            formatter: function (val) {
              return "$ " + val + " thousands";
            },
          },
        },
      };

      startIndex += step;
      chart = new ApexCharts(
        document.querySelector(`#chart-${this.currentId}`),
        options
      );
      chart.render();
    },
    multiGenerateSeq(index) {
      let chart;
      // Group 6 months data
      let startIndex = 0;
      let step = 6; // startIndex + step = 6th item index + 1

      const nextSeries = (start) => {
        return this.series.map(({ name, data }) => ({
          name,
          data: data.slice(start, start + step),
        }));
      };

      const nextCategories = (start) => {
        return this.categories.slice(0, start + step);
      };

      const animations = this.animations
        ? {}
        : {
            enabled: false,
            speed: 0,
            animateGradually: {
              enabled: false,
              delay: 0,
            },
            dynamicAnimation: {
              enabled: false,
              speed: 0,
            },
          };

      const options = {
        series: nextSeries(startIndex),
        chart: {
          type: "bar",
          height: 350,
          events: {
            animationEnd: (ctx) => {
              if (
                startIndex >= this.categories.length &&
                ctx.el.id === this.lastId
              ) {
                this.isLoading = false;
                performance.mark(`charts-end-mount`);
                const p = performance.measure(
                  "mount-end",
                  `charts-start-mount`,
                  `charts-end-mount`
                );
                performance.clearMarks("charts-start-mount");
                performance.clearMarks(`charts-end-mount`);
                this.duration = p.duration.toFixed(4) + "ms";
                return;
              } else if (startIndex >= this.categories.length) {
                return;
              }

              ctx.updateOptions({
                xaxis: {
                  categories: nextCategories(startIndex),
                },
              });
              ctx.appendData(nextSeries(startIndex));
              startIndex += step;
            },
            mounted: (ctx) => {
              if (!this.animations) {
                if (
                  startIndex >= this.categories.length &&
                  ctx.el.id === this.lastId
                ) {
                  this.isLoading = false;
                  performance.mark(`charts-end-mount`);
                  const p = performance.measure(
                    "mount-end",
                    `charts-start-mount`,
                    `charts-end-mount`
                  );
                  performance.clearMarks(`charts-end-mount`);
                  this.mountDuration = p.duration.toFixed(4) + "ms";

                  if (!this.animations) {
                    this.duration = p.duration.toFixed(4) + "ms";
                    performance.clearMarks("charts-start-mount");
                  }
                  return;
                } else if (startIndex >= this.categories.length) {
                  return;
                }

                ctx.updateOptions({
                  xaxis: {
                    categories: nextCategories(startIndex),
                  },
                });
                ctx.appendData(nextSeries(startIndex));
                startIndex += step;
              }
            },
          },
          animations,
        },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: "55%",
            endingShape: "rounded",
          },
        },
        dataLabels: {
          enabled: false,
        },
        stroke: {
          show: true,
          width: 2,
          colors: ["transparent"],
        },
        xaxis: {
          categories: nextCategories(startIndex),
        },
        yaxis: {
          title: {
            text: "$ (thousands)",
          },
        },
        fill: {
          opacity: 1,
        },
        tooltip: {
          y: {
            formatter: function (val) {
              return "$ " + val + " thousands";
            },
          },
        },
      };

      startIndex += step;
      chart = new ApexCharts(
        document.querySelector(`#chart-${index}`),
        options
      );
      chart.render();
    },
  }));
});
