#!/usr/bin/python3.2
"""
 this script retrieves data on arrests associated with the Occupy movement from a particular website (occupyarrests.com),
 looks up the geographical coordinates of the arrest locations in a USgov shapefile,
 and outputs a csv file with the added spatial data.
 developed for data visualization.

 necessary to run this script:
  - Python 3.2
  - internet connection
  - shapefile.py module in same folder as script (available at http://code.google.com/p/pyshp/)
  - FIPS directory: shapefile with municipality locations
         (available at http://www.nws.noaa.gov/geodata/catalog/national/html/cities.htm)
  - Beautiful Soup ($ [python3.2 -m] easy_install beautifulsoup4)
 
 shapefile filename: 'ci01jn11/ci01jn11'

$ python3.2 occu.py "ci01jn11/ci01jn11" "occupyarrests.csv"
 
"""

import sys, re, csv, urllib.request, shapefile
from bs4 import BeautifulSoup

def get_data():
  arrestHTML = urllib.request.urlopen("http://stpeteforpeace.org/occupyarrests.sources.html").read()
  arrestSoup = BeautifulSoup(arrestHTML)
  data = arrestSoup('td', style=re.compile(".*font-family: Arial;"))
  ausgabe = []
  for i in range(len(data)):
    #if 73 < i < 76:
    #print(i, data[i].next.contents[0].encode())
    try:
      if data[i].next.contents and str(type(data[i].next.contents[0])) == "<class 'bs4.element.NavigableString'>":
          ausgabe.append(data[i].next.contents[0])
      else:
        ausgabe.append([])
    except AttributeError:
        print('FLAG')
        print(i, data[i].next.encode())
        ausgabe.append([])
  ausgabe = ausgabe[5:] # get rid of first 5 categories (titles of the table)
  date = []
  loc = []
  count = []
  event = []
  for i in range(0, len(ausgabe), 5):
    date.append(ausgabe[i])
    loc.append(ausgabe[i+1])
    count.append(ausgabe[i+2])
    event.append(ausgabe[i+3])
  source = []
  href = arrestSoup('a')[4:]
  for i in range(len(date)):
    if not date[i]:
      date[i] = date[i-1]
    source.append(href[i]['href']) 
  return arrestSoup, data, date, loc, count, event, source
      
def get_records(filename):
  records = shapefile.Reader(filename).records()
  return records

def loc_refine(loc): # arrrrg
  state = []
  loc2 = loc[:]
  for i in range(len(loc)):
    loc2[i] = re.sub(r'Ft[.]', r'Fort', str(loc2[i])) # expand this idiotic 'Fort' abbreviation
    loc2[i] = re.sub(r'Seatle', r'Seattle', str(loc2[i])) # fix this idiotic misspelling
    loc2[i] = re.sub(r'Washinton', r'Washington', str(loc2[i]))
    loc2[i] = re.sub(r'Franciso', r'Francisco', str(loc2[i])) # seriously, c'mon
    loc2[i] = re.sub(r'^Isla', r'Santa', str(loc2[i])) # sub a couple odd names for more familiar locale titles
    loc2[i] = re.sub(r'Vista$', r'Barbara', str(loc2[i]))
    loc2[i] = re.sub(r'Valley$', r'Desert', str(loc2[i])) # I am really not happy about this part of the code
    loc2[i] = re.sub(r'^Coachella', r'Palm', str(loc2[i]))
    loc2[i] = re.sub(r'^San Marino', r'Pasadena', str(loc2[i]))
    state.append(re.findall(r',*\s(\w[.]*\w[.]*)$', str(loc2[i]))) # if city name ends with state name: put in separate list
    if state[len(state)-1]:
      state[len(state)-1] = re.sub(r'[.\[\]\']', r'', str(state[len(state)-1]))
    loc2[i] = re.sub(r',*\s\w[.]*\w[.]*$', r'', str(loc2[i])) # get rid of state name
    loc2[i] = str(loc2[i]).rstrip() # no trailing whitespace
  return loc2, state

def FIPS_lookup(loc, state, records):
  locC = [name.upper() for name in loc]
  FIPSdict = {}
  for j in range(len(locC)):
    if locC[j] not in FIPSdict:
      recs = []
      for i in range(len(records)):
        if state[j]:
          if locC[j] in records[i][9] and state[j] in records[i][10]:
            recs = [[i, records[i]]]
        elif locC[j] in records[i][9]:
          recs.append([i, records[i]])
        FIPSdict[locC[j]] = recs
        #if locC[j] == 'PORTLAND':
        #  print (recs)
    if len(FIPSdict[locC[j]])==0:
      print("Error: no FIPS directory entry for", locC[j]) # -> you must go tinker with loc_refine to deal with people's typos
  FIPSdict['ATLANTA'][13][1][8] = '486411' # obnoxious data correction. this shapefile is pretty bad on big cities.
  FIPSdict['NEW YORK'][3][1][8] = '8008278'
  FIPSdict['PHILADELPHIA'][8][1][8] = '1209052'
  #print(FIPSdict['PORTLAND'])
  return FIPSdict

"""useful workspace loops for FIPS lookup debugging.

for site in FIPSdict['CITY THAT IT GETS WRONG']:
  print(site) # or: site[1][10]
  print()
  
for key in FIPSdict:
  print (key, len(FIPSdict[key]))  
  for i in range(len(FIPSdict[key])):
     print (' ', FIPSdict[key][i][1][10])
"""

# dumb function - given various cities with the same name, selects the city with highest population
# (unless explicitly told not to via exceptions at the bottom)

def FIPS_winnow(FIPSdict):
  FIPS2 = {}
  for key in FIPSdict:
    FIPS2[key] = FIPSdict[key][:]
    if len(FIPS2[key]) > 1:
      pop = []
      for i in range(len(FIPS2[key])):
        try:
          pop.append(int(FIPS2[key][i][1][8]))
        except ValueError:
          pop.append(0)
      index = pop.index(max(pop))
      maxPop = FIPS2[key][index]
      while not re.search(key + r'$', maxPop[1][9]): # this makes sure the name has the right *ending* - 'lincoln' vs 'lincoln park'
        del pop[index]
        del FIPS2[key][index]
        newInd = pop.index(max(pop))
        maxPop = FIPS2[key][newInd]
      #print (maxPop[1][8:11]) # uncomment to see printout of selected cities for hand-correction purposes
      FIPS2[key] = maxPop
    elif len(FIPS2[key]) == 1:
      FIPS2[key] = FIPS2[key][0]
    else:
      print("Error: no FIPS directory entry for", key) # these should have been flagged already by FIPS_lookup, but hey, just in case
  FIPS2['BURLINGTON'] = FIPSdict['BURLINGTON'][22]
  FIPS2['BLOOMINGTON'] = FIPSdict['BLOOMINGTON'][7]
  FIPS2['BEND'] = FIPSdict['BEND'][21]
  #print(FIPSdict['PORTLAND'])
  FIPS2['PORTLAND'] = [FIPSdict['PORTLAND'][12],FIPSdict['PORTLAND'][16]]
  FIPS2['DARIEN'] = FIPSdict['DARIEN'][4]
  return FIPS2


def data_to_csv(date, loc, count, event, source, state, FIPS2, csvFilename):
  if not re.search(r'[.]csv$',csvFilename):
    csvFilename = csvFilename + ".csv"
  arrest_data = csv.writer(open(csvFilename, 'w', newline = ''), delimiter = ',')
  arrest_data.writerow(['date', 'loc', 'count', 'source', 'SFIPS', 'SFIPS', 'CFIPS', 'CFIPS', 'PLFIPS', 'GNIS-ID-maybe', 'unclear11', 'pop1990', 'pop2000', 'Name', 'State-abb', 'State', 'unclear17', 'unclear18', 'unclear19', 'unclear20', 'unclear21', 'unclear22', 'unclear23', 'unclear24', 'unclear25', 'Long', 'Lat'])
  for i in range(len(date)):
    d = str(date[i])
    l = str(loc[i])
    c = str(count[i])
    e = str(event[i])
    s = str(source[i])
    record = FIPS2[loc[i].upper()][1]
    if l == 'Portland':
      if state[i] == 'ME':
        record = FIPS2['PORTLAND'][0][1]
      else:
        record = FIPS2['PORTLAND'][1][1]
    arrest_data.writerow([d, l, c, s] + record)


def main():
  args = sys.argv[1:]

  if not args:
    print ('usage: [--htmlWrite] shapefile outputCSVfilename')
    sys.exit(1)

  html = False # optional htmlWrite flag saves a prettified local copy of the html code
  if args[0] == '--htmlWrite':
    html = True
    del args[0]

  soup, data, date, loc, count, event, source = get_data()
  records = get_records(args[0])
  loc2, state = loc_refine(loc)
  FIPSdict = FIPS_lookup(loc2, state, records)
  FIPS2 = FIPS_winnow(FIPSdict)
  data_to_csv(date, loc2, count, event, source, state, FIPS2, args[1])
  if html:
    open('arrests.html','bw').write(soup.prettify())
  sys.exit(0)
  
if __name__ == '__main__':
  main()



