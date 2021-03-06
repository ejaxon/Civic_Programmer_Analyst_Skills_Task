import React, { PropTypes } from 'react';
import {connect} from 'react-redux';
import {store} from 'redux';
import {autobind} from 'core-decorators'
import {fetchDataset} from './state/actions/DataActions';
import ToggleButtonSet from './components/ToggleButtonSet';
import PieChart from "./components/PieChart.js";
import BarChart from "./components/BarChart.js";
import {countByField} from "./Transforms";

export default class Dashboard extends React.Component {

  constructor(props) {
    super(props);

    let filters = {};
    let filterButtonStates = {};
    props.config.pagefilters.forEach ( (pf) => {
      filters[pf.field] = {
        filter: [],
        include: true
      };
      filterButtonStates[pf.field] = 0;
    });

    this.state = {
      filters,
      filterButtonStates,
      attVisible: {}
    };
  }

  // Load the datasets on mount
  componentWillMount() {
    fetchDataset(this.props.config.dataset, this.props.dispatch);
  }

  filterDataset (ds0, filter) {
    let ds = {...ds0};
    ds.items = ds0.items.filter( (object) => {
      let keep = true;
      for (let key in filter) {
        if (filter[key].filter.length <= 0) continue; // Nothing to filter
        if (filter[key].include) {
          keep = filter[key].filter.some( (val) => {
            return (object[key] == val);
          }); // Throw out if it matches any value
        }
        else {
          keep = filter[key].filter.every( (val) => {
            return (object[key] != val);
          }); // Throw out if it matches any value
        }
        if (!keep) return keep;
      }
      return keep;
    }, this);
    return ds;
  }

  setFilter(field, def, index) {
    let filters = {...this.state.filters};
    filters[field].filter = def.filter;
    filters[field].include = def.include;
    let filterButtonStates = {...this.state.filterButtonStates};
    filterButtonStates[field] = index;
    this.setState({filters, filterButtonStates});
  }

  createToggleButtonSet (spec) {
    let buttonSpecs = spec.buttons.map( (def, index) => {
      return {
        name: def.name,
        active: (this.state.filterButtonStates[spec.field] == index),
        action: this.setFilter.bind(this, spec.field, def, index)
      };
    });

    return <ToggleButtonSet key={"bs-"+spec.field} title="" options={buttonSpecs}
                            title={spec.name} marginRight="15px"/>
  }

  @autobind
  showValues(e) {
    const id = e.currentTarget.id.substring(4);
    let attVisible = {...this.state.attVisible};
    attVisible[id] = true;
    this.setState({attVisible});
  }

  @autobind
  unShowValues(e) {
    const id = e.currentTarget.id.substring(4);
    let attVisible = {...this.state.attVisible};
    attVisible[id] = false;
    this.setState({attVisible});
  }

  generateAttValuesList(key, input, maxValues) {
    let cmap = {};
    input.forEach( (r) => {
      if (!(r[key] in cmap)) {
        cmap[r[key]] = 1;
      }
      else {
        cmap[r[key]] += 1;
      }
    });
    let list = [];
    for (let key in cmap) {
      list.push({key: key, value: cmap[key]});
    }
    list.sort( (a, b) => {
      return (a.value<b.value)?1:((a.value>b.value)?-1:0);
    });
    let shortList = list.slice(0,maxValues);
    let otherTotal = 0;
    let otherCount = 0;
    list.slice(maxValues).forEach((item)=> {
      ++otherCount;
      otherTotal += item.value;
    });
    if (otherTotal > 0) {
      shortList.push({key: `${otherCount} other values`, value: otherTotal});
    }

    return shortList;
  }

  // Obviously this all needs a little generalization
  createQuickview (spec, input) {
    let data = input;
    if ('transform' in spec && spec.transform) {
      if (spec.transform.type == 'count_by_field') {
        data = countByField(input, spec.transform, this.props.config.dataset.query.usingBackupServer);
      }
      else {
        console.log("createQuickView: unknown transform type " + spec.transform.type);
        return null;
      }
    }
    if (data == null) return data;

    let chart = null;

    switch (spec.type) {
      case 'pie':
        {
          chart = <PieChart data={data} title={spec.title}/>
        }
        break;
      case 'bar':
        {
          if (data.values == null) return null;
          chart = <BarChart data={data.values} labels={data.labels} title={spec.title}/>
        }
        break;
      default:
        {
          console.log("Unknown QuickView type " + spec.type);
          return null;
        }
    }
    return (
      <div>
        {chart}
        <div style={{marginLeft: "10%", marginRight: "5%", marginTop:"5px"}}><b>{spec.description}</b></div>
      </div>
    )
  }

  quickviewSection(quickview, dataset) {
    return (
      <div className="dash-explore-quickview col-md-6 col-xs-12"
        style={{borderStyle:"none",
                borderWidth:"1px", borderColor:"lightgrey"
              }}>
        <div style={{textAlign:"center"}}>
          <h3>Quick View</h3>
        </div>
        <div className="row">
          {quickview.map ((spec, index) => {
            return (
              <div key={"qv-"+index} className="col-md-12" style={{marginBottom: "35px"}}>
                {this.createQuickview(spec, dataset.items)}
              </div>
            )
          })}
          <hr/>
        </div>

        <br/>
      </div>
    )
  }

  keyInfoSection(attributes, attValuesLists) {
    return (
      <div className="dash-explore-keyinfo col-md-6 col-xs-12"
           style={{borderStyle:"none", borderWidth:"1px", borderColor:"lightgrey"}}>
        <div style={{textAlign:"center"}}>
          <h3>Key Dataset Information </h3>
          <div className="container-fluid dash-explore-keyinfo-list"
               style={{marginTop: "15px"}}>

          {attributes.map ( (att) => {
            let moreSpan = null;
            let visiblePanel = null;
            if (att.expandable) {
              const isVisible = (att.name in this.state.attVisible && this.state.attVisible[att.name]);
              if (isVisible) {
                moreSpan = (
                  <span style={{float:"right"}}>
                    <a id={"att-"+att.name} onClick={this.unShowValues} className="btn">Less&nbsp;<i className="fa fa-lg fa-angle-double-up"></i></a>
                  </span>
                );
              }
              else {
                moreSpan = (
                  <span style={{float:"right"}}>
                    <a id={"att-"+att.name} onClick={this.showValues} className="btn">More&nbsp;<i className="fa fa-lg fa-angle-double-down"></i></a>
                  </span>
                );
              }
              if (att.name in this.state.attVisible && this.state.attVisible[att.name]) {
                let icnt = 0;
                if (attValuesLists[att.name] != undefined && attValuesLists[att.name].length > 0) {
                  visiblePanel = (
                    <div className="container-fluid" style={{textAlign:"left", marginBottom:"10px"}}>
                      <hr/>
                        <div key={att.name+"-hdr"} className="row" style={{marginBottom:"5px"}}>
                          <div className="col-md-1"></div>
                          <div className="col-md-6">
                            <u><b>Name</b></u>
                          </div>
                          <div className="col-md-5">
                            <u><b># of Records</b></u>
                          </div>
                        </div>

                        {attValuesLists[att.name].map( (item) => {
                          return (
                            <div key={att.name+"-"+icnt++} className="row">
                              <div className="col-md-1"></div>
                              <div className="col-md-6">
                                {item.key}
                              </div>
                              <div className="col-md-5">
                                {item.value}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                }
                else {
                  visiblePanel = <p>No values found.</p>
                }
              }
            }
            return (
              <div key={"att-key-" + att.name} className="row"
                style={{paddingTop:"5px", marginTop:"5px", borderStyle:"solid",
                        borderWidth:"1px", borderColor:"lightblue",
                        borderRadius: "15px"}}>
                <div style={{textAlign:"left"}} className="col-md-4">
                  <strong style={{fontSize:"105%"}}>{att.display}</strong>&nbsp;
                  <span style={{fontSize:"90%", color:"CornflowerBlue", position:"relative", top: "-5px"}}
                        title={"Field name: " + att.name}><i className="fa fa-info-circle"></i></span>
                </div>
                <div style={{textAlign:"left"}} className="col-md-8">
                  <p>
                    {att.description}
                    {moreSpan}
                  </p>
                  <p>

                  </p>

                </div>
                <div className="col-md-12">
                 {visiblePanel}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </div>
    )
  }

  exploreHeader(explore_title, status_text, pagefilters, totalCount, filteredCount) {
    return (
      <div className = "row dash-explore-header">
        <div className="col-md-12" style={{marginBottom:"20px"}}>
          <h2>{explore_title}</h2>
        </div>
        <div className="col-md-8 col-xs-12">
          <div>
            {
              pagefilters.map ( (pfilter) => {
                return this.createToggleButtonSet(pfilter);
              })
            }
          </div>
        </div>
        <div className="col-md-4 col-xs-12" style={{height:"40px"}} >
          <div style={{marginTop:"15px"}}>
            <p style={{lineHeight:"40px"}}>
               <b>Total:</b> {totalCount} &nbsp;&nbsp;
               <b>Filtered:</b> {filteredCount}
               &nbsp;&nbsp;&nbsp;&nbsp;
               ({status_text})
            </p>
          </div>
        </div>
      </div>
    )
  }

  render() {
    let {common, config, data} = this.props;
    let tag = config.dataset.tag;
    let dataset = {...data.datasets[tag]};
    let attValuesLists = {};
    let attributes = config.attributes;
    let pagefilters = config.pagefilters;
    let totalCount = 0, filteredCount=0;
    let status_text = "Dataload initializing...";
    // Run datasets through any filters that are defined.
    if ((dataset.status == 'add' || dataset.status == 'finish')) {
      if (dataset.status == 'add')
        status_text = "Data loading ...";
      else
        status_text = "All data loaded";
      dataset = this.filterDataset(data.datasets[tag], this.state.filters);
      filteredCount = dataset.items.length;
      totalCount = data.datasets[tag].items.length;
      for (let attKey in this.state.attVisible) {
        attValuesLists[attKey] = this.generateAttValuesList(attKey, dataset.items, config.max_attribute_values_to_show);
      }
    }

    let dataset_visit_link = (config.dataset_url == null)?"":
                             (<span style={{float:"right", marginTop:"25px"}}>
                              <a href={config.dataset_url}>Visit this dataset</a></span>);

    return (
      <div className={"container"}>
        <div className="row dash-header">
          <div className="col-md-8">
            <h1>{config.title}</h1>
          </div>
          <div className="col-md-4">
            {dataset_visit_link}
          </div>
        </div>
        <div className="row dash-description">
          <div className="col-md-12 col-sm-12 col-xs-12">
            <p style={{marginTop:"10px", marginLeft:"25px", marginRight:"25px"}}>{config.description}</p>
          </div>
        </div>

        <div className="container dash-main" style={{marginLeft:"10px",marginRight:"10px"}}>

          {this.exploreHeader(config.explore_title, status_text, pagefilters,
                              totalCount, filteredCount)}

          <div className = "dash-explore-body row" style={{marginTop:"25px"}}>
            {this.keyInfoSection(attributes, attValuesLists)}
            {this.quickviewSection(config.quickview, dataset)}
          </div>
        </div>
      </div>
    );
  }
}

Dashboard.propTypes = {
  common: PropTypes.object.isRequired,
  dispatch: PropTypes.func.isRequired,
  config: PropTypes.object.isRequired
}

function mapStateToProps(state) {
  const { common, data } = state
  return {
    common,
    data
  }
}

export default connect(mapStateToProps)(Dashboard)
